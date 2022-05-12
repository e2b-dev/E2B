#! /usr/bin/sh

set -euo pipefail

# Args:
#  $1: Code snippet ID.
#  $2: Dockerfile as a string.

# Expected environment variables:
# OUTDIR
# ROOTFILE_BASENAME
# SNAPFILE_BASENAME
# MEMFILE_BASENAME

# This script produces 3 files that together creates a Firecracker environment:
# - root: rootfs file
# - snap: snapshot file
# - mem: memory file

# Build container

# Create rootfs

# Start Firecracker

# Stop Firecracker

# Create snapshot

# Cleanup Docker
