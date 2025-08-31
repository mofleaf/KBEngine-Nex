# cmake_minimum_required(VERSION 3.20)
# project(client_lib)

# ---------------- 源文件 ----------------
set(SRCS
    client_interface.cpp
    clientapp.cpp
    clientobjectbase.cpp
    config.cpp
    script_callbacks.cpp
    entity.cpp
    entity_aspect.cpp
    entity_component.cpp
    event.cpp
    moveto_point_handler.cpp
    profile.cpp
)
# ---------------- 创建静态库 ----------------
add_library(client_lib STATIC ${SRCS})


# ---------------- Python ----------------
include(${CMAKE_SOURCE_DIR}/cmakefile/Python.cmake)
target_link_libraries(client_lib PRIVATE KBE::Python)

# ---------------- OpenSSL ----------------
include(${CMAKE_SOURCE_DIR}/cmakefile/OpenSSL.cmake)
target_link_libraries(client_lib PRIVATE OpenSSL::SSL)

# ---------------- log4cxx ----------------

target_link_libraries(client_lib PUBLIC  log4cxx)
target_compile_definitions(client_lib PUBLIC  LOG4CXX_STATIC)
target_link_libraries(client_lib PRIVATE fmt::fmt)



target_link_libraries(client_lib PUBLIC helper)


