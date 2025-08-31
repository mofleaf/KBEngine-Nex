cmake_minimum_required(VERSION 3.20)
project(KBEngineNex LANGUAGES C CXX)

# 设置 C++ 标准
set(CMAKE_CXX_STANDARD 11)


set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 设置多线程支持
set(THREADS_PREFER_PTHREAD_FLAG ON)
find_package(Threads REQUIRED)


# 关闭一些编译警告
add_compile_options(-Wno-deprecated-declarations)



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
    ${KBE_ROOT}/kbe/src/lib/dependencies/fmt/include
    ${KBE_ROOT}/kbe/src/lib/dependencies/curl/include
)




# vcpkg 包

find_package(PkgConfig REQUIRED)
# jemalloc 包
pkg_check_modules(JEMALLOC REQUIRED jemalloc)
# 头文件路径
include_directories(${JEMALLOC_INCLUDE_DIRS})
# 宏定义
add_definitions(${JEMALLOC_CFLAGS_OTHER})
# 所有 target 默认都加 jemalloc 链接选项
add_link_options(${JEMALLOC_LDFLAGS})
add_compile_definitions(USE_JEMALLOC)


find_package(fmt CONFIG REQUIRED)
find_package(EXPAT  REQUIRED COMPONENTS core)

find_package(log4cxx CONFIG REQUIRED)
find_package(ZLIB REQUIRED)
find_package(hiredis CONFIG REQUIRED)



# apr
pkg_check_modules(APR REQUIRED apr-1)
include_directories(${APR_INCLUDE_DIRS})
link_libraries(${APR_LIBRARIES})



# apr-util
pkg_check_modules(APRUTIL REQUIRED apr-util-1)
include_directories(${APRUTIL_INCLUDE_DIRS})
link_libraries(${APRUTIL_LIBRARIES})


add_compile_definitions(
    $<$<CONFIG:Debug>:KBE_CONFIG=\"Debug\">
    $<$<CONFIG:Release>:KBE_CONFIG=\"Release\">
    $<$<CONFIG:RelWithDebInfo>:KBE_CONFIG=\"RelWithDebInfo\">
    $<$<CONFIG:MinSizeRel>:KBE_CONFIG=\"MinSizeRel\">
    ENABLE_WATCHERS=1
)


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
add_subdirectory(server/baseappmgr)
add_subdirectory(server/cellapp)
add_subdirectory(server/cellappmgr)
add_subdirectory(server/dbmgr)
add_subdirectory(server/loginapp)
add_subdirectory(server/machine)
add_subdirectory(server/tools/interfaces)
add_subdirectory(server/tools/logger)
add_subdirectory(server/tools/kbcmd)
add_subdirectory(server/tools/bots)



