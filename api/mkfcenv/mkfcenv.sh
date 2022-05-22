#! /usr/bin/bash

# This script produces 3 files that together creates a Firecracker environment:
# - rootfs: rootfs file
# - snap: snapshot file
# - mem: memory file

RUN_UUID="$1"
SCRIPTDIR="$2"
DOCKERFILE="$3"
CODE_SNIPPET_ID="$4"
ALLOC_DIR="$5"

API_URL="https://ondevbook.com"
ENVS_ENDPOINT="${API_URL}/envs/${CODE_SNIPPET_ID}/status"

set -euo pipefail

if [ -z "$RUN_UUID" ]; then
  echo "ERROR: Expected run UUID as the first argument"
  exit 1
fi

if [ -z "$SCRIPTDIR" ]; then
  echo "ERROR: Expected working dir as the second argument"
  exit 1
fi

if [ -z "$DOCKERFILE" ]; then
  echo "ERROR: Expected Dockerfile as the third argument"
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

echo "==== Args ==========================================================================================="
echo "| RUN_UUID:           $RUN_UUID"
echo "| SCRIPTDIR:          $SCRIPTDIR"
echo "| CODE_SNIPPET_ID:    $CODE_SNIPPET_ID"
echo "| ALLOC_DIR:          $ALLOC_DIR"
echo "======================================================================================================="
echo

# This disk must be mounted when we run the script.
FC_ENVS_DISK="/mnt/disks/fc-envs"

MASK_LONG="255.255.255.252"
FC_MAC="02:FC:00:00:00:05"
FC_ADDR="169.254.0.21"
FC_MASK="/30"
FC_SOCK="/tmp/fc-sock-$RUN_UUID.sock"

TAP_ADDR="169.254.0.22"
TAP_MASK="/30"
TAP_NAME="tap0"

NS_NAME="fc-env-$RUN_UUID"

BUILD_DIR="$FC_ENVS_DISK/$CODE_SNIPPET_ID/builds/$RUN_UUID"
BUILD_MNT_DIR="$BUILD_DIR/mnt"
BUILD_FC_ROOTFS="$BUILD_DIR/rootfs.ext4"
BUILD_FC_SNAPFILE="$BUILD_DIR/snapfile"
BUILD_FC_MEMFILE="$BUILD_DIR/memfile"

FINAL_DIR="$FC_ENVS_DISK/$CODE_SNIPPET_ID"
FINAL_FC_ROOTFS="$FINAL_DIR/rootfs.ext4"
FINAL_FC_SNAPFILE="$FINAL_DIR/snapfile"
FINAL_FC_MEMFILE="$FINAL_DIR/memfile"

FC_PID=""

function mkdirs() {
  mkdir -p $BUILD_DIR
  mkdir -p $BUILD_MNT_DIR
  # `$FINAL_DIR` is now already created because we created the `$BUILD_DIR` or from the previous runs.
}

function mkrootfs() {
  echo "===> Making rootfs..."

  local tag=rootfs
  local free=50000000 # 50MB in B

  echo -e "$DOCKERFILE" | docker build -t $tag -f - $SCRIPTDIR
  local container_id=$(docker run -dt $tag /bin/ash)
  docker exec $container_id /provision.sh
  local container_size=$(docker image inspect $tag:latest --format='{{.Size}}')
  local rootfs_size=$(($container_size+$free))

  echo "===> Rootfs size: ${rootfs_size}B"

  qemu-img create -f raw $BUILD_FC_ROOTFS ${rootfs_size}B
  mkfs.ext4 $BUILD_FC_ROOTFS
  mount $BUILD_FC_ROOTFS $BUILD_MNT_DIR
  docker cp $container_id:/ $BUILD_MNT_DIR

  # -- Cleanup --
  umount $BUILD_MNT_DIR
  rm -rf $BUILD_MNT_DIR

  docker kill $container_id && \
  docker rm -f $container_id && \
  docker rmi -f $tag

  echo "===> rootfs done"
}

function mkns() {
  echo "===> Setting up namespace '$NS_NAME'..."

  ip netns add $NS_NAME
  ip netns exec $NS_NAME ip tuntap add name $TAP_NAME mode tap
  ip netns exec $NS_NAME ip link set $TAP_NAME up
  ip netns exec $NS_NAME ip addr add $TAP_ADDR$TAP_MASK dev $TAP_NAME

  echo "===> Namespace '$NS_NAME' prepared"
}

function delns() {
  ip netns delete $NS_NAME
}

function startfc() {
  local kernel_args="ip=$FC_ADDR::$TAP_ADDR:$MASK_LONG:devbook:eth0:off:8.8.8.8"
  kernel_args="$kernel_args reboot=k panic=1 pci=off nomodules i8042.nokbd i8042.noaux ipv6.disable=1 random.trust_cpu=on"

  local config="vmconfig.json"
  cat <<EOF > $config
{
  "boot-source": {
    "kernel_image_path": "/fc-vm/vmlinux.bin",
    "boot_args": "$kernel_args"
  },
  "drives":[
   {
      "drive_id": "rootfs",
      "path_on_host": "$BUILD_FC_ROOTFS",
      "is_root_device": true,
      "is_read_only": false
    }
  ],
  "network-interfaces": [
    {
      "iface_id": "eth0",
      "guest_mac": "$FC_MAC",
      "host_dev_name": "$TAP_NAME"
    }
  ],
  "machine-config": {
    "vcpu_count": 1,
    "mem_size_mib": 256
  }
}
EOF

  ip netns exec $NS_NAME firecracker \
    --api-sock $FC_SOCK \
    --config-file $config &
  FC_PID=$!
}

function pausefc() {
  curl --unix-socket $FC_SOCK -i \
      -X PATCH 'http://localhost/vm' \
      -H 'Accept: application/json' \
      -H 'Content-Type: application/json' \
      -d '{
              "state": "Paused"
      }'
}

function snapfc() {
  curl --unix-socket $FC_SOCK -i \
      -X PUT 'http://localhost/snapshot/create' \
      -H  'Accept: application/json' \
      -H  'Content-Type: application/json' \
      -d "{
            \"snapshot_type\": \"Full\",
            \"snapshot_path\": \"$BUILD_FC_SNAPFILE\",
            \"mem_file_path\": \"$BUILD_FC_MEMFILE\"
          }"
}

function mv_env_files() {
  mv $BUILD_FC_ROOTFS $FINAL_FC_ROOTFS
  mv $BUILD_FC_SNAPFILE $FINAL_FC_SNAPFILE
  mv $BUILD_FC_MEMFILE $FINAL_FC_MEMFILE
}

function del_build_dir() {
  rm -rf $BUILD_DIR
}

# TODO: Change state of an environment for the code snippet to building.
curl $ENVS_ENDPOINT \
  -X POST \
  -d '{
    "state": "Building"
  }'

mkdirs
mkrootfs
mkns
startfc
sleep 10
pausefc
snapfc
kill $FC_PID
delns
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
echo "===> Env Done"
