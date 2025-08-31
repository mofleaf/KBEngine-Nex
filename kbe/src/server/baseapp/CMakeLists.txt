
# 收集源文件
set(SRCS
	archiver.cpp
	entity.cpp
	entity_component.cpp
	baseapp.cpp
	baseapp_interface.cpp
	backuper.cpp
	entity_messages_forward_handler.cpp
	data_download.cpp
	data_downloads.cpp
	entity_autoloader.cpp
	entity_remotemethod.cpp
	forward_message_over_handler.cpp
	initprogress_handler.cpp
	restore_entity_handler.cpp
	sync_entitystreamtemplate_handler.cpp
	space.cpp
	main.cpp
	proxy.cpp
	proxy_forwarder.cpp
	profile.cpp
)

# 创建可执行程序
add_executable(baseapp ${SRCS})



# link_directories(${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/lib)

# 链接依赖的库（假设这些库已经在主CMake或子库里定义过）
target_link_libraries(baseapp
    PRIVATE
        server
        resmgr
        entitydef
        network
        thread
        pyscript
        common
        helper
        math
        xml
        tinyxml
        g3dlite
        log4cxx
        fmt::fmt

        debug ${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/debug/lib/libaprutil-1.a
        optimized ${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/lib/libaprutil-1.a

        debug ${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/debug/lib/libapr-1.a
        optimized ${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/lib/libapr-1.a

        debug ${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/debug/lib/libexpat.a
        optimized ${KBE_ROOT}/kbe/src/build/vcpkg_installed/x64-linux/lib/libexpat.a

)


# ---------------- Python ----------------
include(${CMAKE_SOURCE_DIR}/cmakefile/Python.cmake)
target_link_libraries(baseapp PRIVATE KBE::Python)
target_link_options(baseapp PRIVATE -Wl,-export-dynamic)

# ---------------- OpenSSL ----------------
include(${CMAKE_SOURCE_DIR}/cmakefile/OpenSSL.cmake)
target_link_libraries(baseapp PRIVATE OpenSSL::SSL)

# 定义宏（可根据 Makefile 里的逻辑来迁移）
target_compile_definitions(baseapp
    PRIVATE
        $<$<CONFIG:Debug>:KBE_CONFIG=\"Debug\">
        $<$<CONFIG:Release>:KBE_CONFIG=\"Release\">
        $<$<CONFIG:RelWithDebInfo>:KBE_CONFIG=\"RelWithDebInfo\">
        $<$<CONFIG:MinSizeRel>:KBE_CONFIG=\"MinSizeRel\">
        ENABLE_WATCHERS=1
)
# 设置可执行文件输出目录
set_target_properties(baseapp PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${KBE_ROOT}/kbe/bin/server"
)