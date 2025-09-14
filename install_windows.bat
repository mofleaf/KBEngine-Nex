@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion



REM =========================================
REM 检查 GitHub 网络可访问性 (Git clone 测试)
REM =========================================
echo [检测] 尝试访问 GitHub ...
set "TMP_TEST_DIR=%TEMP%\gh_test"
if exist "%TMP_TEST_DIR%" rd /s /q "%TMP_TEST_DIR%"
mkdir "%TMP_TEST_DIR%"

git ls-remote https://github.com/microsoft/vcpkg.git >nul 2>nul
if errorlevel 1 (
    echo [错误] 无法访问 GitHub 仓库！
    echo        可能是网络问题或需要代理，请自行解决网络问题后再运行脚本。
    rd /s /q "%TMP_TEST_DIR%" >nul 2>nul
    pause
    exit /b 1
)

rd /s /q "%TMP_TEST_DIR%" >nul 2>nul
echo [成功] GitHub 仓库可访问





REM =========================================
REM 默认参数
REM =========================================
set "CONFIG=Debug"
set "PLATFORM=x64"
set "PROJECT_ROOT=%~dp0"
set "INIT_BUILD_PROJ=%PROJECT_ROOT%kbe\src\server\init\init.vcxproj"
set "SOLUTION_FILE=%PROJECT_ROOT%kbe\src\kbengine nex.sln"
set "GUICONSOLE_SOLUTION_FILE=%PROJECT_ROOT%kbe\src\guiconsole.sln"
set "LOG_FILE=%PROJECT_ROOT%build.log"
set "VCPKG_PATH="

REM =========================================
REM 解析参数
REM =========================================
if "%~1"=="" (
    set "CONFIG=Debug"
) else if /i "%~1"=="Debug" (
    set "CONFIG=Debug"
) else if /i "%~1"=="Release" (
    set "CONFIG=Release"
) else if /i "%~1"=="help" (
    goto showHelp
) else (
    echo [错误] 无效的 CONFIG 参数: %~1
    exit /b 1
)

if not "%~2"=="" (
    set "VCPKG_PATH=%~2"
    if not exist "%VCPKG_PATH%\vcpkg.exe" (
        echo [错误] vcpkgPath 指定的路径无效: %VCPKG_PATH%
        exit /b 1
    )
)

:showHelp
echo =========================================
echo 使用说明:
echo   build.bat [CONFIG] [VCPKGPATH]
echo.
echo 可用参数:
echo   CONFIG=Debug^|Release      指定编译配置，默认 Debug
echo   VCPKGPATH=路径            指定 vcpkg 安装路径
echo   GUICONSOLE            安装 GUICONSOLE
echo =========================================
echo.
if "%~1"=="help" exit /b 0







REM =========================================
REM 1. 检测 vcpkg (修改版)
REM =========================================
echo.
echo [检测] 正在查找 vcpkg...

set "VCPKG_EXE="

REM 1) 优先使用传入参数
if defined VCPKG_PATH (
    set "VCPKG_EXE=%VCPKG_PATH%\vcpkg.exe"
    if not exist "%VCPKG_EXE%" (
        echo [错误] vcpkgPath 指定的路径无效: %VCPKG_PATH%
        exit /b 1
    )
) else (
    REM 2) 在常用安装目录中查找 kbe-vcpkg
    if exist "%USERPROFILE%\AppData\Local\kbe-vcpkg\vcpkg.exe" (
        set "VCPKG_EXE=%USERPROFILE%\AppData\Local\kbe-vcpkg\vcpkg.exe"
        set "VCPKG_PATH=%USERPROFILE%\AppData\Local\kbe-vcpkg"
        goto :found_vcpkg
    )

    REM 3) 如果没有，提示并安装到默认目录
    echo.
    echo [提示] 未检测到 kbe-vcpkg
    set /p "choice=是否自动下载安装 vcpkg 到 %USERPROFILE%\AppData\Local\kbe-vcpkg? (y/n): "
    if /i "!choice!"=="y" (
        echo [下载] 开始下载安装 vcpkg...
        set "VCPKG_PATH=%USERPROFILE%\AppData\Local\kbe-vcpkg"
        echo VCPKG_PATH=!VCPKG_PATH!
        git clone https://github.com/microsoft/vcpkg "!VCPKG_PATH!"
        if errorlevel 1 (
            echo [错误] vcpkg 下载失败
            exit /b 1
        )
        set "VCPKG_EXE=!VCPKG_PATH!\vcpkg.exe"
        call "!VCPKG_PATH!\bootstrap-vcpkg.bat"
    ) else (
        echo [退出] 用户取消安装 vcpkg
        exit /b 1
    )
)

:found_vcpkg
echo [找到] vcpkg 路径: %VCPKG_EXE%
echo [执行] vcpkg integrate install ...
"%VCPKG_EXE%" integrate install







REM =========================================
REM 2. 查找 VS 安装路径和所有 MSVC 工具集
REM =========================================
echo.
echo [检测] 正在查找 Visual Studio 安装路径...

set "VSWHERE_PATH=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE_PATH%" (
    echo [错误] 未找到 vswhere.exe，请确认已安装 Visual Studio 或 Build Tools
    pause
    exit /b 1
)

set "VS_INSTALL_PATH="
for /f "usebackq tokens=*" %%i in (`"%VSWHERE_PATH%" -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
    set "VS_INSTALL_PATH=%%i"
)

if not defined VS_INSTALL_PATH (
    echo [错误] 未找到安装了 C++ 工具集的 Visual Studio
    pause
    exit /b 1
)

echo [找到] Visual Studio 路径: %VS_INSTALL_PATH%
set "MSVC_ROOT=%VS_INSTALL_PATH%\VC\Tools\MSVC"

REM 列出所有 MSVC 工具集版本
set "MSVC_COUNT=0"
set "VCVARS_VAR="
set "MSVC_VER_VAR="
for /d %%v in ("%MSVC_ROOT%\*") do (
    set /a MSVC_COUNT+=1
    set "MSVC_VER_!MSVC_COUNT!=%%~nxv"
)

echo.
if %MSVC_COUNT%==0 (
    echo [warning] 未找到任何 MSVC 工具集，使用默认工具集
) else if %MSVC_COUNT%==1 (
    set "MSVC_VER=!MSVC_VER_1!"
    echo [选择] 使用 MSVC 工具集版本: !MSVC_VER!

    
    set "MSVC_FULL_PATH=%MSVC_ROOT%\!MSVC_VER!"
    set "VCVARS_VAR=-vcvars_ver=!MSVC_VER!"
    set "MSVC_VER_VAR=-p:VCToolsVersion=!MSVC_VER!"

) else (
    echo 找到以下 MSVC 工具集版本:
    for /l %%i in (1,1,%MSVC_COUNT%) do (
        call echo   %%i:!MSVC_VER_%%i!
    )

    echo.
    echo [31m注意：请选择与vcpkg匹配的版本，否则可能导致编译失败，一般是最新版[0m
    echo.
    echo [31m如无法确定版本，请注意后续KBEMain方案编译时日志输出：例如： Compiler found: E:/ProgramFiles/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/14.44.35207/bin/Hostx64/x64/cl.exe[0m
    echo.
    echo [31m其中14.44.35207就是vcpkg所使用的版本[0m
    echo.
    echo [31m或删除多余的程序集，保留一个即可[0m
    echo.
    
    set /p "CHOICE=请选择要使用的 MSVC 工具集编号 (1-%MSVC_COUNT%): "
    if "!CHOICE!"=="" set "CHOICE=1"
    if !CHOICE! GTR !MSVC_COUNT! (
        echo [错误] 输入无效！
        exit /b 1
    )

    call set "MSVC_VER=%%MSVC_VER_!CHOICE!%%"
    echo [选择] 使用 MSVC 工具集版本: !MSVC_VER!


    set "MSVC_FULL_PATH=%MSVC_ROOT%\!MSVC_VER!"
    set "VCVARS_VAR=-vcvars_ver=!MSVC_VER!"
    set "MSVC_VER_VAR=-p:VCToolsVersion=!MSVC_VER!"
)


echo %MSVC_FULL_PATH%
echo %VCVARS_VAR%
echo %MSVC_VER_VAR%

set "VCVARSALL_BAT=%VS_INSTALL_PATH%\VC\Auxiliary\Build\vcvarsall.bat"
call "%VCVARSALL_BAT%" x64 -vcvars_ver=14.38
if errorlevel 1 (
    echo [错误] 无法加载 Visual Studio 编译环境
    pause
    exit /b 1
)


echo cl.exe path: %PATH%
cl



REM =========================================
REM 3. 编译工程
REM =========================================
echo.
echo KBEngine-Nex 构建脚本
echo 项目路径: %PROJECT_ROOT%
echo 编译配置: %CONFIG% ^| 平台: %PLATFORM%
echo 日志文件: %LOG_FILE%
echo.

echo [步骤 1] 编译 KBEMain.vcxproj ...
msbuild "%INIT_BUILD_PROJ%" /p:Configuration=%CONFIG% %MSVC_VER_VAR% /p:Platform=%PLATFORM% /m    ^
    /fileLogger /fileLoggerParameters:LogFile=%LOG_FILE%;Append;Encoding=UTF-8 ^
    /consoleloggerparameters:ForceConsoleColor 
if errorlevel 1 (
    echo [错误] KBEMain.vcxproj 编译失败，请检查 %LOG_FILE%
    pause
    exit /b 1
)


if "%~3"=="GUICONSOLE" (
    echo [安装] 正在安装 GUICONSOLE...
    goto GUICONSOLE
)


@REM /p:VCToolsVersion=%MSVC_VER%
echo.
echo [步骤 2] 编译 kbengine nex.sln ...
msbuild "%SOLUTION_FILE%" /p:Configuration=%CONFIG% %MSVC_VER_VAR% /p:Platform=Win64 /m   ^
    /fileLogger /fileLoggerParameters:LogFile=%LOG_FILE%;Append;Encoding=UTF-8 ^
    /consoleloggerparameters:ForceConsoleColor
if errorlevel 1 (
    echo [错误] kbengine nex.sln 编译失败，请检查 %LOG_FILE%
    pause
    exit /b 1
)

echo.
echo [成功] 全部编译完成！
pause
exit /b 0



:GUICONSOLE
echo.
echo [步骤 2] 安装 GUICONSOLE
msbuild "%GUICONSOLE_SOLUTION_FILE%" /p:Configuration=%CONFIG% %MSVC_VER_VAR% /p:Platform=Win64 /m   ^
    /fileLogger /fileLoggerParameters:LogFile=%LOG_FILE%;Append;Encoding=UTF-8 ^
    /consoleloggerparameters:ForceConsoleColor
if errorlevel 1 (
    echo [错误] guiconsole.sln 编译失败，请检查 %LOG_FILE%
    pause
    exit /b 1
)

echo.
echo [成功] 全部编译完成！
pause
exit /b 0