#!/usr/bin/env bash
set -e  # 出错立即退出

# -----------------------------
# 🧠 1. 检查可用的 Python 命令
# -----------------------------
if command -v "python3.13" &>/dev/null; then
    PYTHON_CMD="python3.13"
elif command -v "python3.12" &>/dev/null; then
    PYTHON_CMD="python3.12"
elif command -v "python3.11" &>/dev/null; then
    PYTHON_CMD="python3.11"
elif command -v "python3.10" &>/dev/null; then
    PYTHON_CMD="python3.10"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
elif command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
else
    echo "❌ 未找到 Python，请先安装 python3 或 python。"
    exit 1
fi

echo "🐍 使用 Python 命令: $PYTHON_CMD"

# -----------------------------
# 📁 2. 创建虚拟环境
# -----------------------------
VENV_DIR=".venv"

if [ -d "$VENV_DIR" ]; then
    echo "⚠️ 虚拟环境已存在：$VENV_DIR"
else
    echo "📦 正在创建虚拟环境..."
    $PYTHON_CMD -m venv "$VENV_DIR"
fi

# -----------------------------
# 🚀 3. 激活虚拟环境
# -----------------------------
if [ -f "$VENV_DIR/bin/activate" ]; then
    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate"
else
    echo "❌ 未找到虚拟环境激活脚本：$VENV_DIR/bin/activate"
    exit 1
fi

# -----------------------------
# 🔧 4. 安装依赖
# -----------------------------
if [ -f "requirements.txt" ]; then
    echo "📦 安装依赖..."
    pip install --upgrade pip
    pip install -r requirements.txt
else
    echo "⚠️ 未找到 requirements.txt，跳过依赖安装。"
fi

# -----------------------------
# ✅ 5. 完成提示
# -----------------------------
echo ""
echo "✨ 虚拟环境创建完成！"
echo "📍 激活命令："
echo "   source $VENV_DIR/bin/activate"
echo ""
echo "🔹 当前 Python 版本："
python --version