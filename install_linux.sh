#!/bin/sh
set -e


# =========================================
# 发行版检测与包管理器选择
# =========================================
UPDATED=0

if command -v apt-get >/dev/null 2>&1; then
    INSTALL_CMD="sudo apt-get install -y"
    PKG_CHECK="dpkg -s"
    PKG_UPDATE="sudo apt-get update -y"
elif command -v dnf >/dev/null 2>&1; then
    INSTALL_CMD="sudo dnf install -y"
    PKG_CHECK="rpm -q"
    PKG_UPDATE="sudo dnf makecache -y"
elif command -v yum >/dev/null 2>&1; then
    INSTALL_CMD="sudo yum install -y"
    PKG_CHECK="rpm -q"
    PKG_UPDATE="sudo yum makecache -y"
elif command -v zypper >/dev/null 2>&1; then
    INSTALL_CMD="sudo zypper install -y"
    PKG_CHECK="rpm -q"
    PKG_UPDATE="sudo zypper refresh"
elif command -v pacman >/dev/null 2>&1; then
    INSTALL_CMD="sudo pacman -S --noconfirm --needed"
    PKG_CHECK="pacman -Qi"
    PKG_UPDATE="sudo pacman -Sy"
elif command -v apk >/dev/null 2>&1; then
    INSTALL_CMD="sudo apk add --no-cache"
    PKG_CHECK="apk info"
    PKG_UPDATE=""
else
    echo "[ERROR] 未知的包管理器，请手动安装依赖"
    exit 1
fi

update_pkg_index() {
    if [ "$UPDATED" -eq 0 ]; then
        if [ -n "$PKG_UPDATE" ]; then
            echo "[INFO] 更新软件源..."
            $PKG_UPDATE || true
        fi
        UPDATED=1
    fi
}


update_pkg_index



install_dep() {
    NAME="$1"
    shift
    for PKG in "$@"; do
        # 检查是否已安装
        if $PKG_CHECK "$PKG" >/dev/null 2>&1; then
            echo "[INFO] $NAME 已安装 ($PKG)"
            return 0
        fi
    done
    # 尝试安装候选包
    for PKG in "$@"; do
        echo "[INFO] 尝试安装 $NAME ($PKG)"
        if $INSTALL_CMD "$PKG" >/dev/null 2>&1; then
            echo "[INFO] 安装成功: $PKG"
            return 0
        fi
    done
    echo "[WARN] 未能安装 $NAME，请手动安装 (候选: $*)"
    return 1
}

# =========================================
# 构建类型
# =========================================
KBE_CONFIG=${1:-Release}
echo "[INFO] 使用构建类型: $KBE_CONFIG"

# =========================================
# 基础工具
# =========================================
install_dep "Git" git
install_dep "GCC" gcc
install_dep "G++" g++ gcc-c++
install_dep "Make" make
install_dep "Autoconf" autoconf
install_dep "Libtool" libtool-bin libtool
install_dep "CMake" cmake
install_dep "pkg-config" pkg-config pkgconf-pkg-config pkgconf
install_dep "Build Tools" build-essential "@development-tools" base-devel base-devel "Development Tools"
install_dep "curl" curl
install_dep "zip" zip
install_dep "unzip" unzip
install_dep "tar" tar

# 检测是否是基于 RedHat 的系统
if [ -f /etc/redhat-release ] || grep -qiE "centos|fedora|red hat" /etc/os-release; then
    install_dep "perl-IPC-Cmd" perl-IPC-Cmd
else
    echo "[INFO] 非 CentOS/RHEL/Fedora 系统，跳过 perl-IPC-Cmd 安装"
fi


# =========================================
# 额外依赖
# =========================================
install_dep "TIRPC" libtirpc-dev libtirpc-devel
install_dep "MySQL/MariaDB" \
    libmysqlclient-dev libmariadb-dev \
    mariadb-devel mysql-devel mariadb-connector-c-devel \
    libmariadb-devel libmysqlclient-devel \
    mariadb-clients mariadb-libs \
    mariadb-connector-c-dev mysql-dev
install_dep "libffi" libffi-dev libffi-devel libffi
install_dep "UUID" uuid-dev libuuid-devel util-linux-dev
install_dep "BZip2" libbz2-dev bzip2-devel libbz2-devel bzip2
install_dep "OpenSSL" libssl-dev openssl-devel openssl-dev
install_dep "Zlib" zlib1g-dev zlib-devel zlib-dev
install_dep "CURL Dev" libcurl4-openssl-dev libcurl-devel curl-dev




# =========================================
# GitHub 可访问性检查
# =========================================
echo "[检测] 尝试访问 GitHub 仓库..."
if ! command -v git >/dev/null 2>&1; then
    echo "[WARN] 未安装 git，稍后会自动安装"
fi

if ! git ls-remote https://github.com/microsoft/vcpkg.git >/dev/null 2>&1; then
    echo "[ERROR] 无法访问 GitHub 仓库，请确保网络或代理可用"
    exit 1
fi
echo "[成功] GitHub 仓库可访问"



# =========================================
# vcpkg 安装
# =========================================
VCPKG_DIR="$HOME/kbe-vcpkg"
if [ ! -d "$VCPKG_DIR" ] || [ ! -f "$VCPKG_DIR/bootstrap-vcpkg.sh" ]; then
    echo "[INFO] 克隆 vcpkg"
    git clone https://github.com/microsoft/vcpkg.git "$VCPKG_DIR"
else
    echo "[INFO] vcpkg 已存在: $VCPKG_DIR"
fi

OLDPWD=$(pwd)
cd "$VCPKG_DIR"
./bootstrap-vcpkg.sh
cd "$OLDPWD"

# =========================================
# 构建 KBEngine-Nex
# =========================================
echo "[INFO] 进入 ./kbe/src/"
cd "./kbe/src/"

echo "[INFO] 配置 CMake"
cmake -B build -S . \
    -DCMAKE_TOOLCHAIN_FILE="$VCPKG_DIR/scripts/buildsystems/vcpkg.cmake" \
    -DKBE_CONFIG="$KBE_CONFIG"

echo "[INFO] 开始编译 KBEngine-Nex"
cmake --build build -j"$(nproc)"

echo "[INFO] 安装完成 🎉"
