#! /usr/bin/bash

# This script creates (mostly using hardlinks) 3 files that together creates a Firecracker environment:
# - rootfs: rootfs file 
# - snap: snapshot file
# - mem: memory file
# - template_id: file pointing to the original code snippet's id - where the env should be mounted 

TEMPLATE="$1"
CODE_SNIPPET_ID="$2"
ALLOC_DIR="$3"
FC_ENVS_DISK="$4"
API_KEY="$5"

set -euo pipefail

if [ -z "$TEMPLATE" ]; then
  echo "ERROR: Expected Template as the first argument"
  exit 1
fi

if [ -z "$CODE_SNIPPET_ID" ]; then
  echo "ERROR: Expected code snippet ID as the second argument"
  exit 1
fi

if [ -z "$ALLOC_DIR" ]; then
  echo "ERROR: Expected alloc dir as the third argument"
  exit 1
fi

# This disk must be mounted when we run the script.
if [ -z "$FC_ENVS_DISK" ]; then
  echo "ERROR: Expected fc envs disk as the fourth argument"
  exit 1
fi

if [ -z "$API_KEY" ]; then
  echo "ERROR: Expected code snippet ID as the fifth argument"
  exit 1
fi

API_URL="https://ondevbook.com"
ENVS_ENDPOINT="${API_URL}/envs/${CODE_SNIPPET_ID}/state?api_key=$API_KEY"

echo "==== Args ==========================================================================================="
echo "| TEMPLATE:           $TEMPLATE"
echo "| CODE_SNIPPET_ID:    $CODE_SNIPPET_ID"
echo "| ALLOC_DIR:          $ALLOC_DIR"
echo "| FC_ENVS_DISK:       $FC_ENVS_DISK"
echo "| API_KEY:            $API_KEY"
echo "======================================================================================================="
echo

TEMPLATE_DIR="$FC_ENVS_DISK/$TEMPLATE"
TEMPLATE_FC_ROOTFS="$TEMPLATE_DIR/rootfs.ext4"
TEMPLATE_FC_SNAPFILE="$TEMPLATE_DIR/snapfile"
TEMPLATE_FC_MEMFILE="$TEMPLATE_DIR/memfile"
TEMPLATE_BUILD_ID="$TEMPLATE_DIR/build_id"

FINAL_DIR="$FC_ENVS_DISK/$CODE_SNIPPET_ID"
FINAL_FC_ROOTFS="$FINAL_DIR/rootfs.ext4"
FINAL_FC_SNAPFILE="$FINAL_DIR/snapfile"
FINAL_FC_MEMFILE="$FINAL_DIR/memfile"
FINAL_FC_EDIT="$FINAL_DIR/edit"
FINAL_FC_BUILDS="$FINAL_DIR/build"
FINAL_TEMPLATE_ID_FILE="$FINAL_DIR/template_id"
FINAL_TEMPLATE_BUILD_ID_FILE="$FINAL_DIR/template_build_id"
FINAL_BUILD_ID_FILE="$FINAL_DIR/build_id"

function mkdirs() {
  mkdir -p $FINAL_DIR
}

function mk_template_files() {
  cp $TEMPLATE_BUILD_ID $FINAL_TEMPLATE_BUILD_ID_FILE
  echo -n "${TEMPLATE}" > ${FINAL_TEMPLATE_ID_FILE}
}

function link_env_files() {
  rm -rf $FINAL_FC_ROOTFS
  rm -rf $FINAL_FC_SNAPFILE
  rm -rf $FINAL_FC_MEMFILE
  rm -rf $FINAL_FC_EDIT
  rm -rf $FINAL_FC_BUILDS
  rm -rf $FINAL_BUILD_ID_FILE
  rm -rf $FINAL_TEMPLATE_ID_FILE
  rm -rf $FINAL_TEMPLATE_BUILD_ID_FILE

  ln $TEMPLATE_FC_ROOTFS $FINAL_FC_ROOTFS
  ln $TEMPLATE_FC_SNAPFILE $FINAL_FC_SNAPFILE
  ln $TEMPLATE_FC_MEMFILE $FINAL_FC_MEMFILE
}

curl $ENVS_ENDPOINT \
  -H "Content-Type: application/json" \
  -X PUT \
  -d "{
    \"state\": \"Building\"
  }"


mkdirs
link_env_files
mk_template_files

touch ${ALLOC_DIR}/main-done


echo "==== Output ==========================================================================================="
echo "| Code snippet ID:        $CODE_SNIPPET_ID"
echo "| Rootfs:                 $FINAL_FC_ROOTFS"
echo "| Snapfile:               $FINAL_FC_SNAPFILE"
echo "| Memfile:                $FINAL_FC_MEMFILE"
echo "| Template ID file:       $FINAL_TEMPLATE_ID_FILE"
echo "| Template build ID file: $FINAL_TEMPLATE_BUILD_ID_FILE"
echo "======================================================================================================="
echo
echo "===> Using prebuilt env"
