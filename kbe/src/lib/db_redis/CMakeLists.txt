# ---------------- 源文件 ----------------
set(SRCS
	common.cpp
	db_exception.cpp
	db_transaction.cpp
	db_interface_redis.cpp
	entity_table_redis.cpp
	kbe_table_redis.cpp
	redis_watcher.cpp
)
# ---------------- 创建静态库 ----------------
add_library(db_redis STATIC ${SRCS})


target_link_libraries(db_redis PRIVATE 
	hiredis::hiredis
	python_interface
)


target_link_libraries(db_redis PUBLIC 
	fmt::fmt
)
