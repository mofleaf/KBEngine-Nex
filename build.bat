@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM =========================================
REM 默认参数
REM =========================================
set "CONFIG=Debug"
set "PLATFORM=x64"
set "PROJECT_ROOT=%~dp0"
set "INIT_BUILD_PROJ=%PROJECT_ROOT%kbe\src\server\init\init.vcxproj"
set "SOLUTION_FILE=%PROJECT_ROOT%kbe\src\kbengine nex.sln"
set "LOG_FILE=%PROJECT_ROOT%build.log"
set "VCPKG_PATH="

REM =========================================
REM 帮助信息
REM =========================================
:showHelp
echo =========================================
echo 使用说明:
echo   build.bat [CONFIG] [VCPKGPATH]
echo.
echo 可用参数:
echo   CONFIG=Debug^|Release      指定编译配置，默认 Debug
echo   VCPKGPATH=路径            指定 vcpkg 安装路径
echo =========================================
echo.


if %~1==help (
    exit /b 0
)

if not "%~1"=="" (
    if "%~1" == "Debug" (
        set "CONFIG=Debug"
    ) else if "%~1" == "Release" (
        set "CONFIG=Release"
    ) else if not "%~1"=="" (
        echo [错误] 无效的 CONFIG 参数: %~1
        exit /b 0
    )
)

if not "%~2"=="" (
    set "VCPKG_PATH=%~2"

    REM =========================================
    REM 校验 vcpkgPath 参数
    REM =========================================
    if not exist "!VCPKG_PATH!\vcpkg.exe" (
        echo [错误] vcpkgPath 指定的路径无效: !VCPKG_PATH!
        exit /b 0
    )
)


echo VCPKG_PATH


REM =========================================
REM 1. 检测 VS 环境
REM =========================================
echo =========================================
echo KBEngine-Nex 构建脚本（自动检测 VS）
echo =========================================
echo 项目路径: %PROJECT_ROOT%
echo 编译配置: %CONFIG% ^| 平台: %PLATFORM%
echo 日志文件: %LOG_FILE%
echo.

echo [检测] 正在查找 Visual Studio 环境...
set "VSWHERE_PATH=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE_PATH%" (
    echo [错误] 未找到 vswhere.exe，请确认已安装 Visual Studio 或 Build Tools
    pause
    exit /b 1
)

for /f "usebackq tokens=*" %%i in (`"%VSWHERE_PATH%" -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
    set "TMP_VS_PATH=%%i"
)
set "VS_INSTALL_PATH=%TMP_VS_PATH%"

if not defined VS_INSTALL_PATH (
    echo [错误] 未找到安装了 C++ 工具集的 Visual Studio，请确认已安装 C++ 组件
    pause
    exit /b 1
)

echo [找到] Visual Studio 路径: %VS_INSTALL_PATH%
echo [找到] vcvarsall  路径: %VS_INSTALL_PATH%\VC\Auxiliary\Build\vcvarsall.bat

call "%VS_INSTALL_PATH%\VC\Auxiliary\Build\vcvarsall.bat" x64
if errorlevel 1 (
    echo [错误] 无法加载 Visual Studio 编译环境
    pause
    exit /b 1
)

REM =========================================
REM 2. 检测 vcpkg
REM =========================================
echo.
echo [检测] 正在查找 vcpkg...

set "VCPKG_EXE="
if defined VCPKG_PATH (
    set "VCPKG_EXE=%VCPKG_PATH%\vcpkg.exe"
) else (
    where vcpkg >nul 2>nul
    if %errorlevel%==0 (
        for /f "delims=" %%i in ('where vcpkg') do set "VCPKG_EXE=%%i"
    )
)

if not defined VCPKG_EXE (
    echo [提示] 未检测到 vcpkg
    set /p "choice=是否自动下载安装 vcpkg? (y/n): "
    if /i "!choice!"=="y" (
        echo [下载] 开始下载安装 vcpkg...
        git clone https://github.com/microsoft/vcpkg "%PROJECT_ROOT%\vcpkg"
        if errorlevel 1 (
            echo [错误] vcpkg 下载失败
            exit /b 1
        )
        set "VCPKG_EXE=%PROJECT_ROOT%\vcpkg\vcpkg.exe"
        call "%PROJECT_ROOT%\vcpkg\bootstrap-vcpkg.bat"
    ) else (
        echo [退出] 用户取消安装 vcpkg
        exit /b 1
    )
)

echo [找到] vcpkg 路径: %VCPKG_EXE%
echo [执行] vcpkg integrate install ...
"%VCPKG_EXE%" integrate install

REM =========================================
REM 3. 编译工程
REM =========================================
echo.
echo [步骤 1] 编译 pythonBuild.vcxproj ...
echo 日志记录到 %LOG_FILE%
powershell -Command "msbuild '%INIT_BUILD_PROJ%' /p:Configuration=%CONFIG% /p:Platform=%PLATFORM% | Tee-Object -FilePath '%LOG_FILE%'"
if errorlevel 1 (
    echo.
    echo [错误] pythonBuild.vcxproj 编译失败，请检查 %LOG_FILE% 获取详细信息！
    pause
    exit /b 1
)

echo.
echo [步骤 2] 编译 kbengine nex.sln ...
echo 日志记录到 %LOG_FILE%
powershell -Command "msbuild '%SOLUTION_FILE%' /p:Configuration=%CONFIG% /p:Platform=Win64 /m | Tee-Object -FilePath '%LOG_FILE%'"
if errorlevel 1 (
    echo.
    echo [错误] kbengine nex.sln 编译失败，请检查 %LOG_FILE% 获取详细信息！
    pause
    exit /b 1
)

echo.
echo [成功] 全部编译完成！
pause
exit /b 0


@REM exit /b 0
