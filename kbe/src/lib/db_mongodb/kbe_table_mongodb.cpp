#include "db_transaction.h"
#include "kbe_table_mongodb.h"
#include "db_interface_mongodb.h"
#include "mongodb_helper.h"
#include "db_interface/db_interface.h"
#include "db_interface/entity_table.h"
#include "entitydef/entitydef.h"
#include "entitydef/scriptdef_module.h"
#include "server/serverconfig.h"

namespace KBEngine {


	//-------------------------------------------------------------------------------------
	bool KBEEntityLogTableMongodb::syncToDB(DBInterface* pdbi)
	{
		/*
		有数据时才产生表数据
		kbe_entitylog:dbid:entityType = hashes(entityID, ip, port, componentID, serverGroupID)
		*/
		
		return true;

		// return MongodbHelper::dropTable(static_cast<DBInterfaceMongodb*>(pdbi), fmt::format(KBE_TABLE_PERFIX "_entitylog:*:*"), false);
	}

	//-------------------------------------------------------------------------------------
	bool KBEEntityLogTableMongodb::logEntity(DBInterface* pdbi, const char* ip, uint32 port, DBID dbid,
		COMPONENT_ID componentID, ENTITY_ID entityID, ENTITY_SCRIPT_UID entityType)
	{
		/*
		kbe_entitylog:dbid:entityType = hashes(entityID, ip, port, componentID, serverGroupID)
		*/
		// std::string sqlstr = fmt::format("HSET " KBE_TABLE_PERFIX "_entitylog:{}:{} entityID {} ip {} port {} componentID {} serverGroupID {}",
		// 	dbid, entityType, entityID, ip, port, componentID, g_componentID);
		//
		// pdbi->query(sqlstr.c_str(), sqlstr.size(), false);
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEEntityLogTableMongodb::queryEntity(DBInterface* pdbi, DBID dbid, EntityLog& entitylog, ENTITY_SCRIPT_UID entityType)
	{
		
		return entitylog.componentID > 0;
	}

	//-------------------------------------------------------------------------------------
	bool KBEEntityLogTableMongodb::eraseEntityLog(DBInterface* pdbi, DBID dbid, ENTITY_SCRIPT_UID entityType)
	{
		// std::string sqlstr = fmt::format("HDEL " KBE_TABLE_PERFIX "_entitylog:{}:{}",
		// 	dbid, entityType);
		//
		// pdbi->query(sqlstr.c_str(), sqlstr.size(), false);
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEEntityLogTableMongodb::eraseBaseappEntityLog(DBInterface* pdbi, COMPONENT_ID componentID)
	{
		return false;
	}

	//-------------------------------------------------------------------------------------
	KBEEntityLogTableMongodb::KBEEntityLogTableMongodb(EntityTables* pEntityTables) :
		KBEEntityLogTable(pEntityTables)
	{
	}


	//-------------------------------------------------------------------------------------
	bool KBEServerLogTableMongodb::syncToDB(DBInterface* pdbi)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEServerLogTableMongodb::updateServer(DBInterface* pdbi)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEServerLogTableMongodb::queryServer(DBInterface* pdbi, ServerLog& serverlog)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	std::vector<COMPONENT_ID> KBEServerLogTableMongodb::queryTimeOutServers(DBInterface* pdbi)
	{
		std::vector<COMPONENT_ID> cids;

		return cids;
	}

	//-------------------------------------------------------------------------------------
	std::vector<COMPONENT_ID> KBEServerLogTableMongodb::queryServers(DBInterface* pdbi)
	{
		std::vector<COMPONENT_ID> cids;

		return cids;
	}

	//-------------------------------------------------------------------------------------
	bool KBEServerLogTableMongodb::clearServers(DBInterface* pdbi, const std::vector<COMPONENT_ID>& cids)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	KBEServerLogTableMongodb::KBEServerLogTableMongodb(EntityTables* pEntityTables) :
		KBEServerLogTable(pEntityTables)
	{
	}

	//-------------------------------------------------------------------------------------
	bool KBEAccountTableMongodb::syncToDB(DBInterface* pdbi)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	KBEAccountTableMongodb::KBEAccountTableMongodb(EntityTables* pEntityTables) :
		KBEAccountTable(pEntityTables)
	{
	}

	//-------------------------------------------------------------------------------------
	bool KBEAccountTableMongodb::setFlagsDeadline(DBInterface* pdbi, const std::string& name, uint32 flags, uint64 deadline)
	{
		/*
		kbe_accountinfos:accountName = hashes(password, bindata, email, entityDBID, flags, deadline, regtime, lasttime, numlogin)
		*/

		// 如果查询失败则返回存在， 避免可能产生的错误
		// if (pdbi->query(fmt::format("HSET " KBE_TABLE_PERFIX "_accountinfos:{} flags {} deadline {}",
		// 	name, flags, deadline), false))
		// 	return true;

		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEAccountTableMongodb::queryAccount(DBInterface* pdbi, const std::string& name, ACCOUNT_INFOS& info)
	{
		
		return info.dbid > 0;
	}

	//-------------------------------------------------------------------------------------
	bool KBEAccountTableMongodb::queryAccountAllInfos(DBInterface* pdbi, const std::string& name, ACCOUNT_INFOS& info)
	{
		

		return info.dbid > 0;
	}

	//-------------------------------------------------------------------------------------
	bool KBEAccountTableMongodb::updateCount(DBInterface* pdbi, const std::string& name, DBID dbid)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEAccountTableMongodb::updatePassword(DBInterface* pdbi, const std::string& name, const std::string& password)
	{
		// 如果查询失败则返回存在， 避免可能产生的错误
		if (!pdbi->query(fmt::format("HSET " KBE_TABLE_PERFIX "_accountinfos:{} password {}", name, password), false))
			return false;

		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEAccountTableMongodb::logAccount(DBInterface* pdbi, ACCOUNT_INFOS& info)
	{
		// std::string sqlstr = fmt::format("HSET " KBE_TABLE_PERFIX "_accountinfos:{} accountName {} password {} bindata {} ",
		// 	"email {} entityDBID {} flags {} deadline {} regtime {} lasttime {}",
		// 	info.name, KBE_MD5::getDigest(info.password.data(), info.password.length()).c_str(),
		// 	info.datas, info.email, info.dbid, info.flags, info.deadline, time(NULL), time(NULL));
		//
		// // 如果查询失败则返回存在， 避免可能产生的错误
		// if (!pdbi->query(sqlstr.c_str(), sqlstr.size(), false))
		// {
		// 	ERROR_MSG(fmt::format("KBEAccountTableMongodb::logAccount({}): cmd({}) is failed({})!\n",
		// 		info.name, sqlstr, pdbi->getstrerror()));
		//
		// 	return false;
		// }

		return true;
	}

	//-------------------------------------------------------------------------------------
	KBEEmailVerificationTableMongodb::KBEEmailVerificationTableMongodb(EntityTables* pEntityTables) :
		KBEEmailVerificationTable(pEntityTables)
	{
	}

	//-------------------------------------------------------------------------------------
	KBEEmailVerificationTableMongodb::~KBEEmailVerificationTableMongodb()
	{
	}

	//-------------------------------------------------------------------------------------
	bool KBEEmailVerificationTableMongodb::queryAccount(DBInterface* pdbi, int8 type, const std::string& name, ACCOUNT_INFOS& info)
	{
		

		return info.datas.size() > 0;
	}

	//-------------------------------------------------------------------------------------
	int KBEEmailVerificationTableMongodb::getDeadline(int8 type)
	{
		int deadline = 3600;
		if (type == (int8)KBEEmailVerificationTable::V_TYPE_CREATEACCOUNT)
			deadline = g_kbeSrvConfig.emailAtivationInfo_.deadline;
		else if (type == (int8)KBEEmailVerificationTable::V_TYPE_RESETPASSWORD)
			deadline = g_kbeSrvConfig.emailResetPasswordInfo_.deadline;
		else if (type == (int8)KBEEmailVerificationTable::V_TYPE_BIND_MAIL)
			deadline = g_kbeSrvConfig.emailBindInfo_.deadline;

		return deadline;
	}

	//-------------------------------------------------------------------------------------
	bool KBEEmailVerificationTableMongodb::logAccount(DBInterface* pdbi, int8 type, const std::string& name,
		const std::string& datas, const std::string& code)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEEmailVerificationTableMongodb::activateAccount(DBInterface* pdbi, const std::string& code, ACCOUNT_INFOS& info)
	{
		
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEEmailVerificationTableMongodb::bindEMail(DBInterface* pdbi, const std::string& name, const std::string& code)
	{
		
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEEmailVerificationTableMongodb::resetpassword(DBInterface* pdbi, const std::string& name,
		const std::string& password, const std::string& code)
	{
		
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEEmailVerificationTableMongodb::delAccount(DBInterface* pdbi, int8 type, const std::string& name)
	{
		
		return true;
	}

	//-------------------------------------------------------------------------------------
	bool KBEEmailVerificationTableMongodb::syncToDB(DBInterface* pdbi)
	{
		return true;
	}

	//-------------------------------------------------------------------------------------
}
