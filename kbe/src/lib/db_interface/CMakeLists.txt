# cmake_minimum_required(VERSION 3.20)
# project(client_lib)

# ---------------- 源文件 ----------------
set(SRCS
	db_interface.cpp
	db_tasks.cpp
	db_threadpool.cpp
	entity_table.cpp
	kbe_tables.cpp
)
# ---------------- 创建静态库 ----------------
add_library(db_interface STATIC ${SRCS})


# ---------------- Python ----------------
include(${CMAKE_SOURCE_DIR}/cmakefile/Python.cmake)
target_link_libraries(db_interface PRIVATE KBE::Python)


target_link_libraries(db_interface PRIVATE fmt::fmt)



