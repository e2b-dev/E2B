#! /usr/bin/bash

# This script produces 3 files that together creates a Firecracker environment:
# - rootfs: rootfs file
# - snap: snapshot file
# - mem: memory file

RUN_UUID="$1"
SCRIPTDIR="$2"
SESSION_ID="$3"
CODE_SNIPPET_ID="$4"
ALLOC_DIR="$5"
FC_ENVS_DISK="$6"
API_KEY="$7"

set -euo pipefail

if [ -z "$RUN_UUID" ]; then
  echo "ERROR: Expected run UUID as the first argument"
  exit 1
fi

if [ -z "$SCRIPTDIR" ]; then
  echo "ERROR: Expected working dir as the second argument"
  exit 1
fi

if [ -z "$CODE_SNIPPET_ID" ]; then
  echo "ERROR: Expected code snippet ID as the fourth argument"
  exit 1
fi

if [ -z "$ALLOC_DIR" ]; then
  echo "ERROR: Expected alloc dir as the fifth argument"
  exit 1
fi

# This disk must be mounted when we run the script.
if [ -z "$FC_ENVS_DISK" ]; then
  echo "ERROR: Expected fc envs disk as the sixth argument"
  exit 1
fi

if [ -z "$API_KEY" ]; then
  echo "ERROR: Expected API key as the seventh argument"
  exit 1
fi

API_URL="https://api.e2b.dev"
ENVS_ENDPOINT="${API_URL}/envs/${CODE_SNIPPET_ID}/state?api_key=$API_KEY"

echo "==== Args ==========================================================================================="
echo "| RUN_UUID:           $RUN_UUID"
echo "| SCRIPTDIR:          $SCRIPTDIR"
echo "| CODE_SNIPPET_ID:    $CODE_SNIPPET_ID"
echo "| ALLOC_DIR:          $ALLOC_DIR"
echo "| FC_ENVS_DISK:       $FC_ENVS_DISK"
echo "| API_KEY:            $API_KEY"
echo "======================================================================================================="
echo

BUILD_DIR="$FC_ENVS_DISK/$CODE_SNIPPET_ID/builds/$RUN_UUID"
BUILD_FC_ROOTFS="$BUILD_DIR/rootfs.ext4"
BUILD_FC_SNAPFILE="$BUILD_DIR/snapfile"
BUILD_FC_MEMFILE="$BUILD_DIR/memfile"

FINAL_DIR="$FC_ENVS_DISK/$CODE_SNIPPET_ID"
FINAL_FC_ROOTFS="$FINAL_DIR/rootfs.ext4"
FINAL_FC_SNAPFILE="$FINAL_DIR/snapfile"
FINAL_FC_MEMFILE="$FINAL_DIR/memfile"

EDIT_DIR="$FC_ENVS_DISK/$CODE_SNIPPET_ID/edit"
EDIT_ID_PATH="$EDIT_DIR/edit_id"

# If no edit_id exists there is nothing to update
if [ ! -f "$EDIT_ID_PATH" ]; then
  echo "$EDIT_ID_PATH does not exist - there is nothing to update"

  touch ${ALLOC_DIR}/main-done

  exit
fi

EDIT_FC_SOCK="/tmp/firecracker-$SESSION_ID.socket"

function mkdirs() {
  mkdir -p $BUILD_DIR
  # `$FINAL_DIR` is now already created because we created the `$BUILD_DIR` or from the previous runs.
}

function get_snapshot() {
  EDIT_ID=$(cat $EDIT_ID_PATH)
  EDIT_ID_DIR="$EDIT_DIR/$EDIT_ID"

  if [[ "$SESSION_ID" == "" ]]; then
    # no session -> copy from edit directory
    cp -pRd --reflink $EDIT_ID_DIR/rootfs.ext4 $BUILD_FC_ROOTFS
    cp -pRd --reflink $EDIT_ID_DIR/memfile $BUILD_FC_MEMFILE
    cp -pRd --reflink $EDIT_ID_DIR/snapfile $BUILD_FC_SNAPFILE
  else
    # session exists -> copy from current session
    SESSION_ROOTFS=$FC_ENVS_DISK/$CODE_SNIPPET_ID/session-envs/$SESSION_ID/rootfs.ext4

    echo "Running edit sessions rootfs path $SESSION_ROOTFS"

    curl --unix-socket $EDIT_FC_SOCK -i \
      -X PATCH 'http://localhost/vm' \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/json' \
      -d '{
                "state": "Paused"
        }'

    curl --unix-socket $EDIT_FC_SOCK -i \
      -X PUT 'http://localhost/snapshot/create' \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/json' \
      -d "{
              \"snapshot_type\": \"Full\",
              \"snapshot_path\": \"$BUILD_FC_SNAPFILE\",
              \"mem_file_path\": \"$BUILD_FC_MEMFILE\"
            }"

    cp -pRd --reflink $SESSION_ROOTFS $BUILD_FC_ROOTFS

    curl --unix-socket $EDIT_FC_SOCK -i \
      -X PATCH 'http://localhost/vm' \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/json' \
      -d '{
                "state": "Resumed"
        }'
  fi
}

function mv_env_files() {
  mv $BUILD_FC_ROOTFS $FINAL_FC_ROOTFS
  mv $BUILD_FC_SNAPFILE $FINAL_FC_SNAPFILE
  mv $BUILD_FC_MEMFILE $FINAL_FC_MEMFILE
}

function del_build_dir() {
  rm -rf $BUILD_DIR
}

curl $ENVS_ENDPOINT \
  -H "Content-Type: application/json" \
  -X PUT \
  -d "{
    \"state\": \"Building\"
  }"

mkdirs
get_snapshot
mv_env_files
del_build_dir

touch ${ALLOC_DIR}/main-done

echo "==== Output ==========================================================================================="
echo "| Code snippet ID:  $CODE_SNIPPET_ID"
echo "| Rootfs:           $FINAL_FC_ROOTFS"
echo "| Snapfile:         $FINAL_FC_SNAPFILE"
echo "| Memfile:          $FINAL_FC_MEMFILE"
echo "======================================================================================================="
echo
echo "===> Env Updated"
