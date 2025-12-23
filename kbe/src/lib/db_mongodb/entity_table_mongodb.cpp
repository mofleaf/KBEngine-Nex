
#include "entity_table_mongodb.h"
#include "kbe_table_mongodb.h"
#include "entitydef/scriptdef_module.h"
#include "entitydef/property.h"
#include "db_interface/db_interface.h"
#include "db_interface/entity_table.h"
#include "network/fixed_messages.h"

#ifndef CODE_INLINE
#include "entity_table_redis.inl"
#endif

namespace KBEngine {


	//-------------------------------------------------------------------------------------
	EntityTableMongodb::EntityTableMongodb(EntityTables* pEntityTables) :
		EntityTable(pEntityTables)
	{
	}

	//-------------------------------------------------------------------------------------
	EntityTableMongodb::~EntityTableMongodb()
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableMongodb::initialize(ScriptDefModule* sm, std::string name)
	{
		DEBUG_MSG(fmt::format("EntityTableMongodb::initialize(): {}.\n", name));
		// 获取表名
		tableName(name);

		// 找到所有存储属性并且创建出所有的字段
		ScriptDefModule::PROPERTYDESCRIPTION_MAP& pdescrsMap = sm->getPersistentPropertyDescriptions();
		ScriptDefModule::PROPERTYDESCRIPTION_MAP::const_iterator iter = pdescrsMap.begin();


		for (; iter != pdescrsMap.end(); ++iter)
		{
			PropertyDescription* pdescrs = iter->second;

			EntityTableItem* pETItem = this->createItem(pdescrs->getDataType()->getName(), pdescrs->getDefaultValStr());

			pETItem->pParentTable(this);
			pETItem->utype(pdescrs->getUType());
			pETItem->tableName(this->tableName());

			bool ret = pETItem->initialize(pdescrs, pdescrs->getDataType(), pdescrs->getName());

			if (!ret)
			{
				delete pETItem;
				return false;
			}

			addItem(pETItem);
		}

		

		// 特殊处理， 数据库保存方向和位置
		if (sm->hasCell())
		{
			ENTITY_PROPERTY_UID posuid = ENTITY_BASE_PROPERTY_UTYPE_POSITION_XYZ;
			ENTITY_PROPERTY_UID diruid = ENTITY_BASE_PROPERTY_UTYPE_DIRECTION_ROLL_PITCH_YAW;

			Network::FixedMessages::MSGInfo* msgInfo =
				Network::FixedMessages::getSingleton().isFixed("Property::position");

			if (msgInfo != NULL)
			{
				posuid = msgInfo->msgid;
				msgInfo = NULL;
			}

			msgInfo = Network::FixedMessages::getSingleton().isFixed("Property::direction");
			if (msgInfo != NULL)
			{
				diruid = msgInfo->msgid;
				msgInfo = NULL;
			}

			EntityTableItem* pETItem = this->createItem("VECTOR3", "");
			pETItem->pParentTable(this);
			pETItem->utype(posuid);
			pETItem->tableName(this->tableName());
			pETItem->itemName("position");
			addItem(pETItem);

			pETItem = this->createItem("VECTOR3", "");
			pETItem->pParentTable(this);
			pETItem->utype(diruid);
			pETItem->tableName(this->tableName());
			pETItem->itemName("direction");
			addItem(pETItem);
		}

		init_db_item_name();
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableMongodb::init_db_item_name()
	{
		EntityTable::TABLEITEM_MAP::iterator iter = tableItems_.begin();
		for (; iter != tableItems_.end(); ++iter)
		{
			// 处理fixedDict字段名称的特例情况
			std::string exstrFlag = "";
			if (iter->second->type() == TABLE_ITEM_TYPE_FIXEDDICT)
			{
				exstrFlag = iter->second->itemName();
				if (exstrFlag.size() > 0)
					exstrFlag += "_";
			}

			static_cast<EntityTableItemMongodbBase*>(iter->second.get())->init_db_item_name(exstrFlag.c_str());
		}
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableMongodb::syncIndexToDB(DBInterface* pdbi)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableMongodb::syncToDB(DBInterface* pdbi)
	{
		if (hasSync())
			return true;

		// DEBUG_MSG(fmt::format("EntityTableMongodb::syncToDB(): {}.\n", tableName()));

		// 对于mongodb不需要一开始将表创建出来，数据写时才产生数据，因此这里不需要创建表
		// 获取当前表的items，检查每个item是否与当前匹配，将其同步为当前表描述

		

		EntityTable::TABLEITEM_MAP::iterator iter = tableItems_.begin();
		for (; iter != tableItems_.end(); ++iter)
		{
			//	if (!iter->second->syncToDB(pdbi, (void*)&outs))
			//		return false;
		}

		std::vector<std::string> dbTableItemNames;

		std::string ttablename = ENTITY_TABLE_PERFIX"_";
		ttablename += tableName();

		pdbi->getTableItemNames(ttablename.c_str(), dbTableItemNames);

		// 检查是否有需要删除的表字段
		std::vector<std::string>::iterator iter0 = dbTableItemNames.begin();
		for (; iter0 != dbTableItemNames.end(); ++iter0)
		{
			std::string tname = (*iter0);

			if (tname == TABLE_ID_CONST_STR ||
				tname == TABLE_ITEM_PERFIX"_" TABLE_AUTOLOAD_CONST_STR ||
				tname == TABLE_PARENTID_CONST_STR)
			{
				continue;
			}

			EntityTable::TABLEITEM_MAP::iterator iter = tableItems_.begin();
			bool found = false;

			for (; iter != tableItems_.end(); ++iter)
			{
				if (iter->second->isSameKey(tname))
				{
					found = true;
					break;
				}
			}

			if (!found)
			{
				if (!pdbi->dropEntityTableItemFromDB(ttablename.c_str(), tname.c_str()))
					return false;
			}
		}

		// 同步表索引
		if (!syncIndexToDB(pdbi))
			return false;

		sync_ = true;
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableMongodb::queryAutoLoadEntities(DBInterface* pdbi, ScriptDefModule* pModule,
		ENTITY_ID start, ENTITY_ID end, std::vector<DBID>& outs)
	{
	}

	//-------------------------------------------------------------------------------------
	EntityTableItem* EntityTableMongodb::createItem(std::string type, std::string defaultVal)
	{
		DEBUG_MSG(fmt::format("EntityTableMongodb::createItem(): {}.\n", type));
		if (type == "INT8")
		{
			return new EntityTableItemMongodb_DIGIT(type, "tinyint not null DEFAULT 0", 4, 0);
		}
		else if (type == "INT16")
		{
			return new EntityTableItemMongodb_DIGIT(type, "smallint not null DEFAULT 0", 6, 0);
		}
		else if (type == "INT32")
		{
			return new EntityTableItemMongodb_DIGIT(type, "int not null DEFAULT 0", 11, 0);
		}
		else if (type == "INT64")
		{
			return new EntityTableItemMongodb_DIGIT(type, "bigint not null DEFAULT 0", 20, 0);
		}
		else if (type == "UINT8")
		{
			return new EntityTableItemMongodb_DIGIT(type, "tinyint unsigned not null DEFAULT 0", 3, 0);
		}
		else if (type == "UINT16")
		{
			return new EntityTableItemMongodb_DIGIT(type, "smallint unsigned not null DEFAULT 0", 5, 0);
		}
		else if (type == "UINT32")
		{
			return new EntityTableItemMongodb_DIGIT(type, "int unsigned not null DEFAULT 0", 10, 0);
		}
		else if (type == "UINT64")
		{
			return new EntityTableItemMongodb_DIGIT(type, "bigint unsigned not null DEFAULT 0", 20, 0);
		}
		else if (type == "FLOAT")
		{
			return new EntityTableItemMongodb_DIGIT(type, "float not null DEFAULT 0", 0, 0);
		}
		else if (type == "DOUBLE")
		{
			return new EntityTableItemMongodb_DIGIT(type, "double not null DEFAULT 0", 0, 0);
		}
		else if (type == "STRING")
		{
			return new EntityTableItemMongodb_STRING("text", 0, 0);
		}
		else if (type == "UNICODE")
		{
			return new EntityTableItemMongodb_UNICODE("text", 0, 0);
		}
		else if (type == "PYTHON")
		{
			return new EntityTableItemMongodb_PYTHON("blob", 0, 0);
		}
		else if (type == "PY_DICT")
		{
			return new EntityTableItemMongodb_PYTHON("blob", 0, 0);
		}
		else if (type == "PY_TUPLE")
		{
			return new EntityTableItemMongodb_PYTHON("blob", 0, 0);
		}
		else if (type == "PY_LIST")
		{
			return new EntityTableItemMongodb_PYTHON("blob", 0, 0);
		}
		else if (type == "BLOB")
		{
			return new EntityTableItemMongodb_BLOB("blob", 0, 0);
		}
		else if (type == "ARRAY")
		{
			return new EntityTableItemMongodb_ARRAY("", 0, 0);
		}
		else if (type == "FIXED_DICT")
		{
			return new EntityTableItemMongodb_FIXED_DICT("", 0, 0);
		}
#ifdef CLIENT_NO_FLOAT
		else if (type == "VECTOR2")
		{
			return new EntityTableItemMongodb_VECTOR2("int not null DEFAULT 0", 0, 0);
		}
		else if (type == "VECTOR3")
		{
			return new EntityTableItemMongodb_VECTOR3("int not null DEFAULT 0", 0, 0);
		}
		else if (type == "VECTOR4")
		{
			return new EntityTableItemMongodb_VECTOR4("int not null DEFAULT 0", 0, 0);
		}
#else
		else if (type == "VECTOR2")
		{
			return new EntityTableItemMongodb_VECTOR2("float not null DEFAULT 0", 0, 0);
		}
		else if (type == "VECTOR3")
		{
			return new EntityTableItemMongodb_VECTOR3("float not null DEFAULT 0", 0, 0);
		}
		else if (type == "VECTOR4")
		{
			return new EntityTableItemMongodb_VECTOR4("float not null DEFAULT 0", 0, 0);
		}
#endif
		else if (type == "ENTITYCALL")
		{
			return new EntityTableItemMongodb_ENTITYCALL("blob", 0, 0);
		}
		else if (type == "ENTITY_COMPONENT")
		{
			return new EntityTableItemMongodb_Component("blob", 0, 0);
		}

		KBE_ASSERT(false && "not found type.\n");
		return new EntityTableItemMongodb_STRING("", 0, 0);
	}

	//-------------------------------------------------------------------------------------
	void EntityTableMongodb::entityShouldAutoLoad(DBInterface* pdbi, DBID dbid, bool shouldAutoLoad)
	{
		if (dbid == 0)
			return;

	}

	//-------------------------------------------------------------------------------------
	DBID EntityTableMongodb::writeTable(DBInterface* pdbi, DBID dbid, int8 shouldAutoLoad, MemoryStream* s, ScriptDefModule* pModule)
	{
		return 0;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableMongodb::removeEntity(DBInterface* pdbi, DBID dbid, ScriptDefModule* pModule)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableMongodb::queryTable(DBInterface* pdbi, DBID dbid, MemoryStream* s, ScriptDefModule* pModule)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableMongodb::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableMongodb::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s, mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableMongodb::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodbBase::init_db_item_name(const char* exstrFlag)
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_VECTOR2::isSameKey(std::string key)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_VECTOR2::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_VECTOR2::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_VECTOR2::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s, mongodb::DBContext& context)
	{
		if (s == NULL)
			return;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_VECTOR2::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_VECTOR3::isSameKey(std::string key)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_VECTOR3::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_VECTOR3::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_VECTOR3::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s, mongodb::DBContext& context)
	{
		if (s == NULL)
			return;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_VECTOR3::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_VECTOR4::isSameKey(std::string key)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_VECTOR4::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_VECTOR4::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_VECTOR4::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s, mongodb::DBContext& context)
	{
		if (s == NULL)
			return;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_VECTOR4::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_ENTITYCALL::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_ENTITYCALL::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_ENTITYCALL::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s, mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_ENTITYCALL::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	bool EntityTableItemMongodb_Component::isSameKey(std::string key)
	{
		return EntityTableItemMongodbBase::isSameKey(key);
	}

	bool EntityTableItemMongodb_Component::initialize(const PropertyDescription* pPropertyDescription,
		const DataType* pDataType, std::string name)
	{
		return EntityTableItemMongodbBase::initialize(pPropertyDescription, pDataType, name);
	}

	bool EntityTableItemMongodb_Component::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	void EntityTableItemMongodb_Component::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
		EntityTableItemMongodbBase::addToStream(s, context, resultDBID);
	}

	void EntityTableItemMongodb_Component::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s,
		mongodb::DBContext& context)
	{
	}

	void EntityTableItemMongodb_Component::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	void EntityTableItemMongodb_Component::init_db_item_name(const char* exstrFlag)
	{
		EntityTableItemMongodbBase::init_db_item_name(exstrFlag);
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_ARRAY::isSameKey(std::string key)
	{
		return false;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_ARRAY::initialize(const PropertyDescription* pPropertyDescription,
		const DataType* pDataType, std::string name)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_ARRAY::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_ARRAY::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_ARRAY::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s, mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_ARRAY::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_ARRAY::init_db_item_name(const char* exstrFlag)
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_FIXED_DICT::isSameKey(std::string key)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_FIXED_DICT::initialize(const PropertyDescription* pPropertyDescription,
		const DataType* pDataType, std::string name)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_FIXED_DICT::syncToDB(DBInterface* pdbi, void* pData)
	{

		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_FIXED_DICT::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_FIXED_DICT::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s, mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_FIXED_DICT::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_FIXED_DICT::init_db_item_name(const char* exstrFlag)
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodbBase::initialize(const PropertyDescription* pPropertyDescription,
		const DataType* pDataType, std::string name)
	{
		itemName(name);

		pDataType_ = pDataType;
		pPropertyDescription_ = pPropertyDescription;
		indexType_ = pPropertyDescription->indexType();
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_DIGIT::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_DIGIT::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_DIGIT::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s, mongodb::DBContext& context)
	{
		if (s == NULL)
			return;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_DIGIT::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_STRING::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_STRING::addToStream(MemoryStream* s,
		mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_STRING::getWriteSqlItem(DBInterface* pdbi,
		MemoryStream* s, mongodb::DBContext& context)
	{
		if (s == NULL)
			return;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_STRING::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_UNICODE::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_UNICODE::addToStream(MemoryStream* s,
		mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_UNICODE::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s,
		mongodb::DBContext& context)
	{
		if (s == NULL)
			return;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_UNICODE::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_BLOB::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_BLOB::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_BLOB::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s, mongodb::DBContext& context)
	{
		if (s == NULL)
			return;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_BLOB::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
	bool EntityTableItemMongodb_PYTHON::syncToDB(DBInterface* pdbi, void* pData)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_PYTHON::addToStream(MemoryStream* s, mongodb::DBContext& context, DBID resultDBID)
	{
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_PYTHON::getWriteSqlItem(DBInterface* pdbi, MemoryStream* s, mongodb::DBContext& context)
	{
		if (s == NULL)
			return;
	}

	//-------------------------------------------------------------------------------------
	void EntityTableItemMongodb_PYTHON::getReadSqlItem(mongodb::DBContext& context)
	{
	}

	//-------------------------------------------------------------------------------------
}
