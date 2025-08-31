cmake_minimum_required(VERSION 3.20)
project(KBEngineNex LANGUAGES C CXX)

# 设置 C++ 标准
set(CMAKE_CXX_STANDARD 11)


set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 设置多线程支持
set(THREADS_PREFER_PTHREAD_FLAG ON)
find_package(Threads REQUIRED)


if(NOT DEFINED KBE_ROOT)
    string(REGEX REPLACE "/kbe/src(/.*)?$" "" KBE_ROOT "${CMAKE_SOURCE_DIR}")
endif()

# -----------------------------
# 1. vcpkg toolchain 支持
# -----------------------------
# 这里使用环境变量 VCPKG_ROOT 指向 vcpkg 安装目录
# if(DEFINED ENV{VCPKG_ROOT})
#     set(CMAKE_TOOLCHAIN_FILE "$ENV{VCPKG_ROOT}/scripts/buildsystems/vcpkg.cmake"
#         CACHE STRING "")
# else()
#     message(WARNING "VCPKG_ROOT not defined, vcpkg packages will not be available")
# endif()

# 输出目录
set(LIB_OUTPUT_DIR "${CMAKE_SOURCE_DIR}/libs")
file(MAKE_DIRECTORY ${LIB_OUTPUT_DIR})

# # 统一输出目录
# set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${KBE_ROOT}/kbe/src/libs)
# set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${KBE_ROOT}/kbe/src/libs)
# set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${KBE_ROOT}/kbe/src/libs)



include_directories(
    ${KBE_ROOT}/kbe/src
    ${KBE_ROOT}/kbe/src/lib
    ${KBE_ROOT}/kbe/src/server
    ${KBE_ROOT}/kbe/src/lib/dependencies
    ${KBE_ROOT}/kbe/src/lib/dependencies/g3dlite
    ${KBE_ROOT}/kbe/src/lib/dependencies/curl/include
)


# vcpkg 包
find_package(fmt CONFIG REQUIRED)
find_package(EXPAT  REQUIRED COMPONENTS core)

# find_package(log4cxx CONFIG REQUIRED)
find_package(ZLIB REQUIRED)
find_package(hiredis CONFIG REQUIRED)





add_library(log4cxx STATIC IMPORTED)

# Debug 版本
set_target_properties(log4cxx PROPERTIES
    IMPORTED_LOCATION_DEBUG "${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/debug/lib/liblog4cxx.a"
    INTERFACE_LINK_LIBRARIES_DEBUG
        "${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/debug/lib/libaprutil-1.a;
         ${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/debug/lib/libapr-1.a;
         ${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/debug/lib/libexpat.a"
)

# Release 版本
set_target_properties(log4cxx PROPERTIES
    IMPORTED_LOCATION_RELEASE "${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/lib/liblog4cxx.a"
    INTERFACE_LINK_LIBRARIES_RELEASE
        "${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/lib/libaprutil-1.a;
         ${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/lib/libapr-1.a;
         ${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/lib/libexpat.a"
)



if(NOT DISABLE_WATCHERS)
    add_definitions(-DENABLE_WATCHERS)
endif()



# 关闭 curl 的一些不必要的组件
set(BUILD_SHARED_LIBS OFF CACHE BOOL "Build shared libraries")
set(BUILD_CURL_EXE OFF CACHE BOOL "Disable curl executable")
set(BUILD_TESTING OFF CACHE BOOL "Disable curl tests")
set(ENABLE_MANUAL OFF CACHE BOOL "Disable curl manual")
set(CURL_DISABLE_MANUAL ON CACHE BOOL "Disable curl man page")
set(BUILD_DOC OFF CACHE BOOL "Disable curl documentation")

add_subdirectory(lib/dependencies/curl)
add_subdirectory(lib/dependencies/g3dlite)
add_subdirectory(lib/dependencies/jwsmtp/jwsmtp/jwsmtp)
add_subdirectory(lib/dependencies/sigar/linux)

# ------------------------
# jemalloc 构建
# # ------------------------
# add_custom_target(jemalloc ALL
#     COMMAND chmod -R 755 ${CMAKE_CURRENT_SOURCE_DIR}/lib/dependencies/jemalloc
#     COMMAND ./autogen.sh
#     COMMAND make
#     WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/lib/dependencies/jemalloc
#     COMMENT "Building jemalloc"
# )

# # 构建完成后，把生成的库文件拷贝到 libs
# # 假设 jemalloc 生成的是 libjemalloc.a 或 libjemalloc.so
# add_custom_command(TARGET jemalloc POST_BUILD
#     COMMAND ${CMAKE_COMMAND} -E copy_if_different
#         ${CMAKE_CURRENT_SOURCE_DIR}/lib/dependencies/jemalloc/lib/libjemalloc.a
#         ${LIB_OUTPUT_DIR}/libjemalloc.a
# )


# jemalloc 头文件
set(JEMALLOC_DIR ${KBE_ROOT}/kbe/src/lib/dependencies/jemalloc)

add_custom_command(
    OUTPUT ${LIB_OUTPUT_DIR}/libjemalloc.a
    COMMAND chmod -R 755 ${CMAKE_CURRENT_SOURCE_DIR}/lib/dependencies/jemalloc
    COMMAND ./autogen.sh
    COMMAND make
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${JEMALLOC_DIR}/lib/libjemalloc.a
        ${LIB_OUTPUT_DIR}/libjemalloc.a
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/lib/dependencies/jemalloc
    COMMENT "Building jemalloc"
)

add_custom_target(jemalloc ALL
    DEPENDS ${LIB_OUTPUT_DIR}/libjemalloc.a
)

add_compile_definitions(USE_JEMALLOC)
include_directories(${JEMALLOC_DIR}/include)


# 1. 创建一个 INTERFACE 库，统一传递 jemalloc 配置给所有目标
add_library(jemalloc_interface INTERFACE)

# 2. 添加头文件
target_include_directories(jemalloc_interface INTERFACE ${JEMALLOC_DIR}/include)

# 3. 添加宏定义
target_compile_definitions(jemalloc_interface INTERFACE USE_JEMALLOC)

# 4. 链接库
target_link_libraries(jemalloc_interface 
    INTERFACE
        ${LIB_OUTPUT_DIR}/libjemalloc.a
        Threads::Threads
        dl
        rt
)

# 5. 确保 jemalloc 构建完成后再链接
add_dependencies(jemalloc_interface jemalloc)





add_subdirectory(lib/dependencies/tinyxml)
add_subdirectory(lib/dependencies/tmxparser)

add_subdirectory(lib/python)
add_subdirectory(lib/helper)
add_subdirectory(lib/client_lib)
add_subdirectory(lib/common)
add_subdirectory(lib/db_interface)
add_subdirectory(lib/db_mysql)
add_subdirectory(lib/db_redis)
add_subdirectory(lib/entitydef)
add_subdirectory(lib/math)
add_subdirectory(lib/navigation)
add_subdirectory(lib/network)
add_subdirectory(lib/pyscript)
add_subdirectory(lib/resmgr)
add_subdirectory(lib/server)
add_subdirectory(lib/thread)
add_subdirectory(lib/xml)


add_subdirectory(server/baseapp)



