

#include "kbe_table_mongodb.h"
#include "db_exception.h"
#include "db_interface_mongodb.h"

#include "entity_table_mongodb.h"
#include "mongodb_helper.h"
#include "mongodb_watcher.h"
#include "thread/threadguard.h"
#include "helper/watcher.h"
#include "server/serverconfig.h"

namespace KBEngine {

	mongoc_client_pool_t* KBEngine::DBInterfaceMongodb::s_pClientPool_ = nullptr;
	std::mutex            KBEngine::DBInterfaceMongodb::s_poolMutex_;
	bool                  KBEngine::DBInterfaceMongodb::s_mongocInited_ = false;

	//-------------------------------------------------------------------------------------
	DBInterfaceMongodb::DBInterfaceMongodb(const char* name) :
		DBInterface(name),
		pClient_(nullptr),
		hasLostConnection_(false),
		inTransaction_(false)
	{
		DEBUG_MSG(fmt::format("DBInterfaceMongodb::DBInterfaceMongodb: {}\n", name));

	}

	//-------------------------------------------------------------------------------------
	DBInterfaceMongodb::~DBInterfaceMongodb()
	{
		DBInterfaceMongodb::detach();

		// 注意：不要在这里 mongoc_cleanup()
		// 进程退出时由系统统一清理
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::initInterface(DBInterface* pdbi)
	{
		EntityTables& entityTables = EntityTables::findByInterfaceName(pdbi->name());

		entityTables.addKBETable(new KBEAccountTableMongodb(&entityTables));
		entityTables.addKBETable(new KBEServerLogTableMongodb(&entityTables));
		entityTables.addKBETable(new KBEEntityLogTableMongodb(&entityTables));
		entityTables.addKBETable(new KBEEmailVerificationTableMongodb(&entityTables));
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::checkEnvironment()
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::checkErrors()
	{
		

		return true;
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::ping()
	{
		if (!pClient_)
			return false;

		bson_t cmd;
		bson_init(&cmd);
		BSON_APPEND_INT32(&cmd, "ping", 1);

		bson_error_t error;
		bool ok = mongoc_client_command_simple(
			pClient_,
			"admin",
			&cmd,
			nullptr,
			nullptr,
			&error);

		bson_destroy(&cmd);

		if (!ok)
		{
			ERROR_MSG(fmt::format(
				"DBInterfaceMongodb::ping failed: {}\n", error.message));
			hasLostConnection_ = true;
			return false;
		}

		return true;
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::attach(const char* databaseName)
	{
		MongodbWatcher::initializeWatcher();

		// 27017：主服务端口
		// 27018：分片 / 备份 / 测试常用
		// 27019：配置服务器常用
		if (db_port_ == 0)
			db_port_ = 27017;

		if (databaseName != NULL)
			kbe_snprintf(db_name_, MAX_BUF, "%s", databaseName);
		else
			kbe_snprintf(db_name_, MAX_BUF, "%s", "kbenginelab");

		hasLostConnection_ = false;

		DEBUG_MSG(fmt::format("DBInterfaceMongodb::attach: connect: {}:{} starting...\n", db_ip_, db_port_));

		std::lock_guard<std::mutex> guard(s_poolMutex_);

		if (!s_mongocInited_)
		{
			mongoc_init();
			s_mongocInited_ = true;
		}

		if (!s_pClientPool_)
		{
			// 构造 MongoDB URI
			// mongodb://user:password@ip:port/dbname?authSource=admin
			char uriStr[512] = { 0 };

			if (strlen(db_username_) > 0)
			{
				kbe_snprintf(uriStr, sizeof(uriStr),
					"mongodb://%s:%s@%s:%d/%s?authSource=admin&maxPoolSize=32",
					db_username_,
					db_password_,
					db_ip_,
					db_port_,
					databaseName ? databaseName : "admin");
			}
			else
			{
				kbe_snprintf(uriStr, sizeof(uriStr),
					"mongodb://%s:%d/%s?maxPoolSize=32",
					db_ip_,
					db_port_,
					databaseName ? databaseName : "admin");
			}

			mongoc_uri_t* uri = mongoc_uri_new(uriStr);
			if (!uri)
			{
				ERROR_MSG("DBInterfaceMongodb::attach: invalid mongodb uri\n");
				return false;
			}

			s_pClientPool_ = mongoc_client_pool_new(uri);
			// mongoc_client_pool_set_max_size(s_pClientPool_, 32);

			mongoc_uri_destroy(uri);
		}

		pClient_ = mongoc_client_pool_pop(s_pClientPool_);
		if (!pClient_)
		{
			ERROR_MSG("DBInterfaceMongodb::attach: pop client failed\n");
			return false;
		}


		hasLostConnection_ = false;

		DEBUG_MSG(fmt::format("DBInterfaceMongodb::attach: successfully! addr: {}:{}\n", db_ip_, db_port_));

		return ping();
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::reattach()
	{
		detach();

		bool ret = false;

		try
		{
			ret = attach(db_name_);
		}
		catch (...)
		{
			return false;
		}

		return ret;
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::detach()
	{
		// 归还 client
		std::lock_guard<std::mutex> guard(s_poolMutex_);

		if (pClient_)
		{
			mongoc_client_pool_push(s_pClientPool_, pClient_);
			pClient_ = nullptr;
		}

		return true;
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::getTableNames(std::vector<std::string>& tableNames, const char* pattern)
	{
		tableNames.clear();

		if (!s_pClientPool_)
		{
			ERROR_MSG("DBInterfaceMongodb::getTableNames: no client pool\n");
			return false;
		}

		mongoc_client_t* client = mongoc_client_pool_pop(s_pClientPool_);
		if (!client)
			return false;

		mongoc_database_t* db = mongoc_client_get_database(client, db_name_);
		if (!db)
		{
			mongoc_client_pool_push(s_pClientPool_, client);
			return false;
		}

		bson_t filter;
		bson_init(&filter);

		bson_error_t error;
		mongoc_cursor_t* cursor =
			mongoc_database_find_collections(db, &filter, &error);

		if (!cursor)
		{
			ERROR_MSG(fmt::format(
				"DBInterfaceMongodb::getTableNames error: {}\n", error.message));

			bson_destroy(&filter);
			mongoc_database_destroy(db);
			mongoc_client_pool_push(s_pClientPool_, client);
			return false;
		}

		const bson_t* doc;
		while (mongoc_cursor_next(cursor, &doc))
		{
			bson_iter_t iter;
			if (bson_iter_init_find(&iter, doc, "name") &&
				BSON_ITER_HOLDS_UTF8(&iter))
			{
				std::string name = bson_iter_utf8(&iter, nullptr);

				// pattern 过滤（可选）
				if (pattern && *pattern)
				{
					if (name.find(pattern) == std::string::npos)
						continue;
				}

				tableNames.push_back(name);
			}
		}

		if (mongoc_cursor_error(cursor, &error))
		{
			ERROR_MSG(fmt::format(
				"DBInterfaceMongodb::getTableNames cursor error: {}\n",
				error.message));
		}

		mongoc_cursor_destroy(cursor);
		bson_destroy(&filter);
		mongoc_database_destroy(db);
		mongoc_client_pool_push(s_pClientPool_, client);

		return true;
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::getTableItemNames(const char* tableName, std::vector<std::string>& itemNames)
	{
		// 暂不支持，因为 mongodb 无法直接获取表项结构，只能多文档采样合并字段（扫描 前 N 条 document或者全量采集），
		// 所以不可控，DBMgr 启动可能扫几千万条数据，数据越多越慢，导致 DBMgr 阻塞，没必要做
		// 而且数据也支持冗余，不做删除就好
		return true;
	}


	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::query(const char* cmd, uint32 size, bool printlog, MemoryStream* result)
	{
		if (!pClient_)
		{
			if (printlog)
			{
				ERROR_MSG(fmt::format("DBInterfaceMongodb::query: has no attach(db)!\nsql:({})\n", lastquery_));
			}

			if (result)
				write_query_result(result);

			return false;
		}

		lastquery_.assign(cmd, size);

		DEBUG_MSG(fmt::format("DBInterfaceMongodb::query({:p}): {}\n", (void*)this, lastquery_));

		// 清理上一次结果
		if (lastCursor_)
		{
			mongoc_cursor_destroy(lastCursor_);
			lastCursor_ = nullptr;
		}
		affectedCount_ = 0;

		bson_error_t error;
		bson_t* root = bson_new_from_json((const uint8_t*)cmd, size, &error);
		if (!root)
		{
			ERROR_MSG(fmt::format(
				"DBInterfaceMongodb::query: invalid json: {}\n", error.message));
			return false;
		}

		bson_iter_t it;
		const char* op = nullptr;
		const char* collectionName = nullptr;

		if (!bson_iter_init_find(&it, root, "op") || !BSON_ITER_HOLDS_UTF8(&it))
		{
			// goto _error;
			bson_destroy(root);
			return false;
		}

		op = bson_iter_utf8(&it, nullptr);

		if (!bson_iter_init_find(&it, root, "collection") || !BSON_ITER_HOLDS_UTF8(&it))
		{
			// goto _error;
			bson_destroy(root);
			return false;
		}

		collectionName = bson_iter_utf8(&it, nullptr);

		mongoc_collection_t* collection =
			mongoc_client_get_collection(pClient_, db_name_, collectionName);

		/* ---------------- find ---------------- */
		if (strcmp(op, "find") == 0)
		{
			bson_t filter, opts;
			bson_init(&filter);
			bson_init(&opts);

			if (bson_iter_init_find(&it, root, "filter") && BSON_ITER_HOLDS_DOCUMENT(&it))
			{
				const uint8_t* data;
				uint32_t len;
				bson_iter_document(&it, &len, &data);
				bson_t sub;
				bson_init_static(&sub, data, len);
				bson_copy_to(&sub, &filter);
			}

			if (bson_iter_init_find(&it, root, "options") && BSON_ITER_HOLDS_DOCUMENT(&it))
			{
				const uint8_t* data;
				uint32_t len;
				bson_iter_document(&it, &len, &data);
				bson_t sub;
				bson_init_static(&sub, data, len);
				bson_copy_to(&sub, &opts);
			}

			lastCursor_ = mongoc_collection_find_with_opts(
				collection, &filter, &opts, nullptr);

			bson_destroy(&filter);
			bson_destroy(&opts);
		}
		/* ---------------- insert ---------------- */
		else if (strcmp(op, "insert") == 0)
		{
			bson_t document;
			bson_init(&document);

			if (!bson_iter_init_find(&it, root, "document") ||
				!BSON_ITER_HOLDS_DOCUMENT(&it))
			{
				mongoc_collection_destroy(collection);
				return false;
			}

			const uint8_t* data;
			uint32_t len;
			bson_iter_document(&it, &len, &data);
			bson_t sub;
			bson_init_static(&sub, data, len);
			bson_copy_to(&sub, &document);

			if (!mongoc_collection_insert_one(
				collection, &document, nullptr, nullptr, &error))
			{
				ERROR_MSG(fmt::format("insert failed: {}\n", error.message));
				bson_destroy(&document);
				mongoc_collection_destroy(collection);
				return false;
			}

			affectedCount_ = 1;
			bson_destroy(&document);
		}
		/* ---------------- update ---------------- */
		else if (strcmp(op, "update") == 0)
		{
			bson_t filter, update;
			bson_init(&filter);
			bson_init(&update);

			if (bson_iter_init_find(&it, root, "filter") && BSON_ITER_HOLDS_DOCUMENT(&it))
			{
				const uint8_t* data;
				uint32_t len;
				bson_iter_document(&it, &len, &data);
				bson_t sub;
				bson_init_static(&sub, data, len);
				bson_copy_to(&sub, &filter);
			}

			if (bson_iter_init_find(&it, root, "update") && BSON_ITER_HOLDS_DOCUMENT(&it))
			{
				const uint8_t* data;
				uint32_t len;
				bson_iter_document(&it, &len, &data);
				bson_t sub;
				bson_init_static(&sub, data, len);
				bson_copy_to(&sub, &update);
			}

			if (!mongoc_collection_update_one(
				collection, &filter, &update, nullptr, nullptr, &error))
			{
				ERROR_MSG(fmt::format("update failed: {}\n", error.message));
				bson_destroy(&filter);
				bson_destroy(&update);
				mongoc_collection_destroy(collection);
				return false;
			}

			affectedCount_ = 1;
			bson_destroy(&filter);
			bson_destroy(&update);
		}
		/* ---------------- delete ---------------- */
		else if (strcmp(op, "delete") == 0)
		{
			bson_t filter;
			bson_init(&filter);

			if (bson_iter_init_find(&it, root, "filter") && BSON_ITER_HOLDS_DOCUMENT(&it))
			{
				const uint8_t* data;
				uint32_t len;
				bson_iter_document(&it, &len, &data);
				bson_t sub;
				bson_init_static(&sub, data, len);
				bson_copy_to(&sub, &filter);
			}

			if (!mongoc_collection_delete_one(
				collection, &filter, nullptr, nullptr, &error))
			{
				ERROR_MSG(fmt::format("delete failed: {}\n", error.message));
				bson_destroy(&filter);
				mongoc_collection_destroy(collection);
				return false;
			}

			affectedCount_ = 1;
			bson_destroy(&filter);
		}
		else
		{
			ERROR_MSG(fmt::format("unknown op: {}\n", op));
			// goto _error_collection;
			mongoc_collection_destroy(collection);
			return false;
		}

		mongoc_collection_destroy(collection);
		bson_destroy(root);

		// 和 MySQL 完全一致的行为
		return result == NULL || (write_query_result(result), true);

	// _error_collection:
	// 	mongoc_collection_destroy(collection);
	// _error:
		// bson_destroy(root);
		// return false;
	}


	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::write_query_result( MemoryStream* result)
	{
		if (!result)
			return true;

		/* ---------- SELECT / FIND ---------- */
		if (lastCursor_)
		{
			size_t wpos = result->wpos();
			uint32 nrows = 0;
			uint32 nfields = 1; // Mongo：每行一个 document

			try
			{
				(*result) << nfields;
				(*result) << (uint32)0; // 占位 nrows

				const bson_t* doc;

				while (mongoc_cursor_next(lastCursor_, &doc))
				{
					char* json = bson_as_canonical_extended_json(doc, nullptr);

					// 每一行只有 1 列：document
					result->appendBlob(json, strlen(json));

					bson_free(json);
					++nrows;
				}

				// 回填 nrows
				size_t endpos = result->wpos();
				result->wpos(wpos + sizeof(uint32));
				(*result) << nrows;
				result->wpos(endpos);
			}
			catch (MemoryStreamWriteOverflow& e)
			{
				result->wpos(wpos);

				DBException e1(this);
				e1.setError(
					fmt::format("DBException: {}, Mongo query failed", e.what()),
					0);

				throwError(&e1);

				return false;
			}

			mongoc_cursor_destroy(lastCursor_);
			lastCursor_ = nullptr;
			return true;
		}

		/* ---------- INSERT / UPDATE / DELETE ---------- */
		uint32 nfields = 0;
		uint64 affectedRows = (uint64)affectedCount_;
		uint64 lastInsertID = 0; // Mongo 不支持自增 ID

		(*result) << nfields;
		(*result) << affectedRows;
		(*result) << lastInsertID;

		return true;
	}


	//-------------------------------------------------------------------------------------
	const char* DBInterfaceMongodb::c_str()
	{
		static std::string strdescr;
		strdescr = fmt::format("interface={}, dbtype=mongodb, ip={}, port={}, currdatabase={}, username={}, connected={}.\n",
			name_, db_ip_, db_port_, db_name_, db_username_, (pClient_ == NULL ? "no" : "yes"));

		return strdescr.c_str();
	}

	//-------------------------------------------------------------------------------------
	const char* DBInterfaceMongodb::getstrerror()
	{
		return hasLostConnection_ ? "mongodb lost connection" : "";
	}

	//-------------------------------------------------------------------------------------
	int DBInterfaceMongodb::getlasterror()
	{
		if (pClient_ == NULL)
			return 0;

		return 1;
	}

	//-------------------------------------------------------------------------------------
	EntityTable* DBInterfaceMongodb::createEntityTable(EntityTables* pEntityTables)
	{
		return new EntityTableMongodb(pEntityTables);
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::dropEntityTableFromDB(const char* tableName)
	{
		KBE_ASSERT(tableName != NULL);

		if (!pClient_)
		{
			ERROR_MSG("DBInterfaceMongodb::dropEntityTableFromDB: not attached!\n");
			return false;
		}

		DEBUG_MSG(fmt::format(
			"DBInterfaceMongodb::dropEntityTableFromDB: drop collection {}.\n",
			tableName));

		bson_error_t error;

		mongoc_collection_t* collection =
			mongoc_client_get_collection(pClient_, db_name_, tableName);

		if (!collection)
			return false;

		bool ok = mongoc_collection_drop(collection, &error);

		if (!ok)
		{
			ERROR_MSG(fmt::format(
				"DBInterfaceMongodb::dropEntityTableFromDB failed: {}\n",
				error.message));
		}

		mongoc_collection_destroy(collection);
		return ok;
	}



	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::dropEntityTableItemFromDB(
		const char* tableName,
		const char* tableItemName)
	{
		KBE_ASSERT(tableName != NULL && tableItemName != NULL);

		if (!pClient_)
		{
			ERROR_MSG("DBInterfaceMongodb::dropEntityTableItemFromDB: not attached!\n");
			return false;
		}

		DEBUG_MSG(fmt::format(
			"DBInterfaceMongodb::dropEntityTableItemFromDB: {} remove field {}.\n",
			tableName, tableItemName));

		bson_error_t error;

		mongoc_collection_t* collection =
			mongoc_client_get_collection(pClient_, db_name_, tableName);

		if (!collection)
			return false;

		bson_t filter;
		bson_init(&filter); // 空 filter = 所有 document

		bson_t update;
		bson_init(&update);

		bson_t unset;
		bson_init(&unset);

		// { "$unset": { "field": "" } }
		BSON_APPEND_UTF8(&unset, tableItemName, "");

		BSON_APPEND_DOCUMENT(&update, "$unset", &unset);

		bool ok = mongoc_collection_update_many(
			collection,
			&filter,
			&update,
			nullptr,
			nullptr,
			&error);

		if (!ok)
		{
			ERROR_MSG(fmt::format(
				"DBInterfaceMongodb::dropEntityTableItemFromDB failed: {}\n",
				error.message));
		}

		bson_destroy(&unset);
		bson_destroy(&update);
		bson_destroy(&filter);
		mongoc_collection_destroy(collection);

		return ok;
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::lock()
	{
		// mongodb 不需要
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::unlock()
	{
		// mongodb 不需要
		return true;
	}

	//-------------------------------------------------------------------------------------
	void DBInterfaceMongodb::throwError(DBException* pDBException)
	{
		if (pDBException)
		{
			throw* pDBException;
		}
		else
		{
			DBException e(this);

			if (e.isLostConnection())
			{
				this->hasLostConnection(true);
			}

			throw e;
		}
	}

	//-------------------------------------------------------------------------------------
	bool DBInterfaceMongodb::processException(std::exception& e)
	{
		DBException* dbe = static_cast<DBException*>(&e);
		bool retry = false;

		if (dbe->isLostConnection())
		{
			INFO_MSG(fmt::format("DBInterfaceMongodb::processException: "
				"Thread {:p} lost connection to database. Exception: {}. "
				"Attempting to reconnect.\n",
				(void*)this,
				dbe->what()));

			int attempts = 1;

			while (!this->reattach())
			{
				ERROR_MSG(fmt::format("DBInterfaceMongodb::processException: "
					"Thread {:p} reconnect({}) attempt {} failed({}).\n",
					(void*)this,
					db_name_,
					attempts,
					getstrerror()));

				KBEngine::sleep(30);
				++attempts;
			}

			INFO_MSG(fmt::format("DBInterfaceMongodb::processException: "
				"Thread {:p} reconnected({}). Attempts = {}\n",
				(void*)this,
				db_name_,
				attempts));

			retry = true;
		}
		else if (dbe->shouldRetry())
		{
			WARNING_MSG(fmt::format("DBInterfaceMongodb::processException: Retrying {:p}\nException:{}\nnlastquery={}\n",
				(void*)this, dbe->what(), lastquery_));

			retry = true;
		}
		else
		{
			WARNING_MSG(fmt::format("DBInterfaceMongodb::processException: "
				"Exception: {}\nlastquery={}\n",
				dbe->what(), lastquery_));
		}

		return retry;
	}

	//-------------------------------------------------------------------------------------
}
