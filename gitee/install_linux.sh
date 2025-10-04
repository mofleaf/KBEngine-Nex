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
    IGNORE_FAIL="$2"
    shift 2
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
    if [ "$IGNORE_FAIL" = true ]; then
        return 0
    else
        return 1
    fi
}



# 检测是否为 CentOS / RHEL / Fedora
is_centos() {
    [ -f /etc/os-release ] && grep -qiE 'centos\|rhel\|fedora' /etc/os-release
}

# =========================================
# 构建类型
# =========================================
KBE_CONFIG=${1:-Release}
echo "[INFO] 使用构建类型: $KBE_CONFIG"

# =========================================
# 基础工具
# =========================================
install_dep "Git" false git
install_dep "GCC" false gcc
install_dep "G++" false g++ gcc-c++
install_dep "Make" false make
install_dep "Autoconf" false autoconf
install_dep "Libtool" false libtool-bin libtool
install_dep "CMake" false cmake
install_dep "pkg-config" false pkg-config pkgconf-pkg-config pkgconf

install_dep "curl" false curl
install_dep "zip" false zip
install_dep "unzip" false unzip
install_dep "tar" false tar

# 安装 Build Tools，只在非 CentOS 系列执行
if ! is_centos; then
    install_dep "Build Tools"  false build-essential "@development-tools" base-devel
else
    echo "[INFO] Skipping 'Build Tools' installation on CentOS/RHEL/Fedora"
fi



# =========================================
# 额外依赖
# =========================================

if is_centos; then
    # 安装 dnf-plugins-core
    install_dep "dnf-plugins-core" true dnf-plugins-core 
    sudo dnf config-manager --set-enabled crb  || true
else
    echo "[INFO] 非 CentOS/RHEL/Fedora 系统，跳过 dnf-plugins-core 安装"
fi


install_dep "TIRPC"  false libtirpc-dev libtirpc-devel
install_dep "MySQL/MariaDB"  false \
    libmysqlclient-dev libmariadb-dev \
    mariadb-devel mysql-devel mariadb-connector-c-devel \
    libmariadb-devel libmysqlclient-devel \
    mariadb-clients mariadb-libs \
    mariadb-connector-c-dev mysql-dev
install_dep "libffi"  false libffi-dev libffi-devel libffi
install_dep "UUID"  false uuid-dev libuuid-devel util-linux-dev
install_dep "BZip2"  false libbz2-dev bzip2-devel libbz2-devel bzip2
install_dep "OpenSSL"  false libssl-dev openssl-devel openssl-dev
install_dep "Zlib"  false zlib1g-dev zlib-devel zlib-dev
install_dep "CURL Dev"  false libcurl4-openssl-dev libcurl-devel curl-dev

if $PKG_CHECK "libmariadb-dev" >/dev/null 2>&1; then
    install_dep "libmariadb-dev-compat"  true libmariadb-dev-compat
fi


if is_centos; then
    # 安装 Perl
    install_dep "perl" false perl
    install_dep "perl-core" false perl-core
    install_dep "perl-IPC-Cmd" false perl-IPC-Cmd
    install_dep "perl-FindBin" true perl-FindBin
else
    echo "[INFO] 非 CentOS/RHEL/Fedora 系统，跳过 perl安装"
fi

# =========================================
# GitHub 可访问性检查
# =========================================
echo "[检测] 尝试访问 GitHub 仓库..."
if ! command -v git >/dev/null 2>&1; then
    echo "[WARN] 未安装 git，稍后会自动安装"
fi

if ! git ls-remote https://gitee.com/KBEngineLab/kbe-vcpkg-gitee.git >/dev/null 2>&1; then
    echo "[ERROR] 无法访问 Gitee 仓库，请确保网络可用"
    exit 1
fi
echo "[成功] Gitee 仓库可访问"



# =========================================
# vcpkg 安装
# =========================================
VCPKG_DIR="$HOME/kbe-vcpkg-gitee"
if [ ! -d "$VCPKG_DIR" ] || [ ! -f "$VCPKG_DIR/bootstrap-vcpkg.sh" ]; then
    echo "[INFO] 克隆 vcpkg"
    git clone https://gitee.com/KBEngineLab/kbe-vcpkg-gitee.git "$VCPKG_DIR"
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
echo "[INFO] 进入 ../kbe/src/"
cd "../kbe/src/"

echo "[INFO] 配置 CMake"
cmake -B build -S . \
    -DCMAKE_TOOLCHAIN_FILE="$VCPKG_DIR/scripts/buildsystems/vcpkg.cmake" \
    -DKBE_CONFIG="$KBE_CONFIG"

echo "[INFO] 开始编译 KBEngine-Nex"
cmake --build build -j"$(nproc)"

echo "[INFO] 安装完成 🎉"
