#!/usr/bin/env bash
set -e

# ==============================
# 安装 KBEngine-Nex 脚本
# ==============================

# 默认构建类型（可通过参数覆盖）
KBE_CONFIG=${1:-Release}

echo ">>> 使用构建类型: $KBE_CONFIG"

# ------------------------------
# 1. 检查系统版本
# ------------------------------
UBUNTU_VERSION=$(lsb_release -rs | cut -d'.' -f1)
if [ "$UBUNTU_VERSION" -lt 20 ]; then
    echo "错误: 需要 Ubuntu 20.04 或更高版本，当前版本: $UBUNTU_VERSION"
    exit 1
fi
echo ">>> 系统版本检查通过: Ubuntu $UBUNTU_VERSION"

# ------------------------------
# 2. 检查 gcc g++
# ------------------------------
if ! command -v gcc >/dev/null 2>&1; then
    echo ">>> 安装 gcc"
    sudo apt-get update
    sudo apt-get install -y gcc
fi
if ! command -v g++ >/dev/null 2>&1; then
    echo ">>> 安装 g++"
    sudo apt-get update
    sudo apt-get install -y g++
fi

# ------------------------------
# 3. autoconf
# ------------------------------
if ! command -v autoconf >/dev/null 2>&1; then
    echo ">>> 安装 autoconf"
    sudo apt-get update
    sudo apt-get install -y autoconf
fi

# ------------------------------
# 4. libtool-bin
# ------------------------------
if ! dpkg -s libtool-bin >/dev/null 2>&1; then
    echo ">>> 安装 libtool-bin"
    sudo apt-get update
    sudo apt-get install -y libtool-bin
fi

# ------------------------------
# 5. libtirpc-dev
# ------------------------------
if ! dpkg -s libtirpc-dev >/dev/null 2>&1; then
    echo ">>> 安装 libtirpc-dev"
    sudo apt-get update
    sudo apt-get install -y libtirpc-dev
fi

# ------------------------------
# 6. libmysqlclient-dev
# ------------------------------
if ! dpkg -s libmysqlclient-dev >/dev/null 2>&1; then
    echo ">>> 安装 libmysqlclient-dev"
    sudo apt-get update
    sudo apt-get install -y libmysqlclient-dev
fi

# ------------------------------
# 7. curl zip unzip tar
# ------------------------------
for pkg in curl zip unzip tar; do
    if ! command -v $pkg >/dev/null 2>&1; then
        echo ">>> 安装 $pkg"
        sudo apt-get update
        sudo apt-get install -y $pkg
    fi
done

# ------------------------------
# 8. cmake
# ------------------------------
if ! command -v cmake >/dev/null 2>&1; then
    echo ">>> 安装 cmake"
    sudo apt-get update
    sudo apt-get install -y cmake
fi



if ! command -v pkg-config >/dev/null 2>&1; then
    echo ">>> 安装 pkg-config"
    sudo apt-get update
    sudo apt-get install -y pkg-config
fi



if ! command -v build-essential >/dev/null 2>&1; then
    echo ">>> 安装 build-essential"
    sudo apt-get update
    sudo apt-get install -y build-essential
fi

# ------------------------------
# 9. vcpkg
# ------------------------------
VCPKG_DIR=~/kbe-vcpkg
if [ ! -d "$VCPKG_DIR" ] || [ ! -f "$VCPKG_DIR/bootstrap-vcpkg.sh" ]; then
    echo ">>> 克隆并安装 vcpkg"
    git clone https://github.com/microsoft/vcpkg.git "$VCPKG_DIR"
    
else
    echo ">>> vcpkg 已存在: $VCPKG_DIR"
fi

OLDPWD=$(pwd)


cd "$VCPKG_DIR"
./bootstrap-vcpkg.sh
cd "$OLDPWD"

echo ">>> ./kbe/src/"
cd "./kbe/src/"

# ------------------------------
# 10. 运行 CMake 配置
# ------------------------------
echo ">>> 配置 CMake"
cmake -B build -S . -DCMAKE_TOOLCHAIN_FILE=$VCPKG_DIR/scripts/buildsystems/vcpkg.cmake -DKBE_CONFIG=$KBE_CONFIG

# ------------------------------
# 11. 构建
# ------------------------------
echo ">>> 开始编译 KBEngine-Nex"
cmake --build build -j8

echo ">>> 安装完成 🎉"
