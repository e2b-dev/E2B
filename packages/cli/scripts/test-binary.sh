#!/usr/bin/env bash
set -euo pipefail

# Navigate to the package root directory (one level up from scripts)
cd "$(dirname "$0")/.."

# --- Configuration ---
OUTPUT_DIR="./release"
PACKAGE_JSON="./package.json"

# --- Get Version ---
if [ ! -f "$PACKAGE_JSON" ]; then
  echo "Error: package.json not found at $PACKAGE_JSON!"
  exit 1
fi
VERSION=$(node -p "require('$PACKAGE_JSON').version")
if [ -z "$VERSION" ]; then
  echo "Error: Could not extract version from $PACKAGE_JSON!"
  exit 1
fi

# --- Determine Native OS and Arch ---
OS_LOWER=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH_RAW=$(uname -m)
ARCH_LOWER=""

case "$ARCH_RAW" in
  x86_64) ARCH_LOWER="x64" ;;
  arm64|aarch64) ARCH_LOWER="arm64" ;;
  *) echo "Error: Unsupported architecture for testing: $ARCH_RAW"; exit 1 ;;
esac

# Construct OS/Arch suffix for filename (only Linux supported by this script for now)
if [ "$OS_LOWER" == "linux" ]; then
  OS_ARCH_SUFFIX="linux_${ARCH_LOWER}"
  EXTENSION=""
elif [ "$OS_LOWER" == "darwin" ]; then
  OS_ARCH_SUFFIX="darwin_${ARCH_LOWER}"
  EXTENSION=""
else
  echo "Error: Script currently only supports testing on Linux or Darwin, not $OS_LOWER"
  exit 1
fi

echo "Attempting to test binary for native platform: ${OS_ARCH_SUFFIX}"

# --- Find and Test Binary ---
NATIVE_BINARY="${OUTPUT_DIR}/cli_${VERSION}_${OS_ARCH_SUFFIX}${EXTENSION}"

echo "Checking if binary exists: $NATIVE_BINARY"
if [ ! -f "$NATIVE_BINARY" ]; then
  echo "Error: Native binary not found at $NATIVE_BINARY!"
  ls -la "$OUTPUT_DIR" # List contents for debugging
  exit 1
fi

echo "Making binary executable..."
chmod +x "$NATIVE_BINARY"

echo "Running: $NATIVE_BINARY --version"
OUTPUT=$("$NATIVE_BINARY" --version)
EXIT_CODE=$?

echo "Output: $OUTPUT"
echo "Exit Code: $EXIT_CODE"

if [ $EXIT_CODE -ne 0 ]; then
  echo "Error: Binary execution failed with exit code $EXIT_CODE!"
  exit 1
fi

echo "Checking output for version string '$VERSION'..."
if ! echo "$OUTPUT" | grep -q "$VERSION"; then
  echo "Error: Version string '$VERSION' not found in output!"
  exit 1
fi

echo "Native binary test passed for ${OS_ARCH_SUFFIX}!"