#!/usr/bin/env bash
set -euo pipefail

# Navigate to the package root directory (one level up from scripts)
cd "$(dirname "$0")/.."

# --- Configuration ---
ENTRY_POINT="./src/index.ts"
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
echo "Building binaries for version: $VERSION"

# --- Prepare Output Directory ---
echo "Preparing output directory: $OUTPUT_DIR"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# --- Define Targets ---
# Format: "<desired_os>_<desired_arch>:<bun_target>:<outfile_extension>"
TARGETS=(
  "linux_x64:bun-linux-x64:"
  "darwin_x64:bun-darwin-x64:"
  "darwin_arm64:bun-darwin-arm64:"
  "windows_x64:bun-windows-x64:.exe"
  "linux_arm64:bun-linux-arm64:"
)

# --- Build Logic ---
echo "Starting Bun compilation..."
for target_info in "${TARGETS[@]}"; do
  IFS=':' read -r os_arch bun_target extension <<< "$target_info"
  outfile="${OUTPUT_DIR}/cli_${VERSION}_${os_arch}${extension}"

  echo "  Compiling for ${os_arch} -> ${outfile}"
  bun build "$ENTRY_POINT" --compile --target "$bun_target" --outfile "$outfile"
  if [ $? -ne 0 ]; then
    echo "Error: Bun build failed for target ${bun_target}!"
    exit 1
  fi
done

echo "Build complete. Binaries generated."

# --- Generate Checksums ---
CHECKSUM_FILE="${OUTPUT_DIR}/cli_${VERSION}_checksums.txt"
echo "Generating checksums -> ${CHECKSUM_FILE}"
# Navigate into the output directory to generate relative paths in the checksum file
cd "$OUTPUT_DIR"
# Use sha256sum to generate checksums for all files EXCEPT the checksum file itself
# The output format matches the example (hash<space><space>filename)
sha256sum * > "$(basename "$CHECKSUM_FILE")"
# Go back to the package root
cd ..

echo "Checksums generated:"
cat "$CHECKSUM_FILE"

echo "Build script finished successfully."