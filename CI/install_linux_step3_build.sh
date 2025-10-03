#!/bin/sh
set -e

cd ./kbe/src/
echo "[INFO] Starting build..."
cmake --build build -j"$(nproc)"

echo "[INFO] Step 3 complete 🎉"