project(embed_python NONE)

# Python 源码目录
set(PYTHON_SRC_DIR ${CMAKE_CURRENT_SOURCE_DIR})
set(PYTHON_BUILD_DIR ${PYTHON_SRC_DIR}/build)
set(PYTHON_LIB ${PYTHON_SRC_DIR}/libpython3.13.a)


set(KBE_PYTHON_INCLUDE_DIRS
    ${KBE_ROOT}/kbe/src/lib/python/Include
    ${KBE_ROOT}/kbe/src/lib/python
    CACHE PATH "KBE Python include dirs"
)

set(KBE_PYTHON_LIB
    ${KBE_ROOT}/kbe/src/libs/libpython.a
    CACHE FILEPATH "KBE Python static library"
)

# 额外依赖
set(KBE_PYTHON_EXTRA_LIBS pthread util dl)



if(NOT DEFINED KBE_ROOT)
    string(REGEX REPLACE "/kbe/src(/.*)?$" "" KBE_ROOT "${CMAKE_SOURCE_DIR}")
endif()


set(RES_SCRIPTS_DIR ${KBE_ROOT}/kbe/res/scripts/common)
set(LIB_DIR ${KBE_ROOT}/kbe/src/libs)

# --------------------------------------------------------
# 1) 编译 Python，只在 libpython3.13.a 不存在时执行
# --------------------------------------------------------
add_custom_command(
    OUTPUT ${PYTHON_LIB}
    COMMAND test -f ${PYTHON_LIB} || (./configure --enable-optimizations && make -j)
    WORKING_DIRECTORY ${PYTHON_SRC_DIR}
    COMMENT "Building embedded Python..."
)


# 定义构建目标
add_custom_target(python_build ALL
    DEPENDS ${PYTHON_LIB}
)

# --------------------------------------------------------
# 2) 拷贝 libpython.a
# --------------------------------------------------------
add_custom_command(TARGET python_build POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${LIB_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${PYTHON_LIB}
        ${LIB_DIR}/libpython.a
    COMMENT "Copying libpython.a to ${LIB_DIR}"
)

# --------------------------------------------------------
# 3) 拷贝 lib-dynload
# --------------------------------------------------------
add_custom_command(TARGET python_build POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${RES_SCRIPTS_DIR}/lib-dynload
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${PYTHON_BUILD_DIR}/lib.*
        ${RES_SCRIPTS_DIR}/lib-dynload
    COMMENT "Copying Python extension modules"
)

# --------------------------------------------------------
# 4) 拷贝 Lib
# --------------------------------------------------------
add_custom_command(TARGET python_build POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${RES_SCRIPTS_DIR}/Lib
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${PYTHON_SRC_DIR}/Lib
        ${RES_SCRIPTS_DIR}/Lib
    COMMENT "Copying Python Lib directory"
)




# --------------------------------------------------------
# 5) 定义 INTERFACE target，供子项目使用
# --------------------------------------------------------
add_library(python_interface INTERFACE)
target_link_libraries(python_interface INTERFACE ${LIB_DIR}/libpython.a)
add_dependencies(python_interface python_build)

set_target_properties(python_interface PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "${KBE_PYTHON_INCLUDE_DIRS}"
    INTERFACE_LINK_LIBRARIES "${KBE_PYTHON_LIB};${KBE_PYTHON_EXTRA_LIBS}"
)
