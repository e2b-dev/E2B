#! /usr/bin/bash


# Args:
#  $1: Path to Firecracker
#  $2: Code snippet ID.
#  $3: Dockerfile as a string.

# Expected environment variables:
# OUTDIR
# ROOTFILE_BASENAME
# SNAPFILE_BASENAME
# MEMFILE_BASENAME

# This script produces 3 files that together creates a Firecracker environment:
# - rootfs: rootfs file
# - snap: snapshot file
# - mem: memory file

WORKINGDIR="$1"
CODE_SNIPPET_ID="$2"

set -euo pipefail

if [ -z "$WORKINGDIR" ]; then
  echo "ERROR: Expected working dir as the first argument"
  exit 1
fi

if [ -z "$CODE_SNIPPET_ID" ]; then
  echo "ERROR: Expected code snippet ID as the second argument"
  exit 1
fi

MASK_LONG="255.255.255.252"

FC_MAC="02:FC:00:00:00:05"
FC_ADDR="169.254.0.21"
FC_MASK="/30"

TAP_ADDR="169.254.0.22"
TAP_MASK="/30"
TAP_NAME="tap0"

ID=$RANDOM
NS_NAME="fc-env-$ID"
FC_SOCK="/tmp/fc-$ID.socket"
FC_ROOTFS="rootfs.ext4"
FC_SNAPFILE="snapfile"
FC_MEMFILE="memfile"

FC_PID=""

function mkrootfs() {
  echo "===> MAKING ROOTFS..."
  local tag=rootfs

  local mountdir=mnt
  local free=50000000 # 50MB in B

  docker build -t $tag -f $WORKINGDIR/Dockerfile $WORKINGDIR
  local container_id=$(docker run -dt $tag /bin/ash)
  docker exec $container_id /provision.sh
  local container_size=$(docker image inspect $tag:latest --format='{{.Size}}')
  local rootfs_size=$(($container_size+$free))

  echo "===> Rootfs size: ${rootfs_size}B"

  mkdir $mountdir
  qemu-img create -f raw $FC_ROOTFS ${rootfs_size}B
  mkfs.ext4 $FC_ROOTFS
  mount $FC_ROOTFS $mountdir
  docker cp $container_id:/ $mountdir

  # -- Cleanup --
  umount $mountdir
  rm -rf $mountdir

  docker kill $container_id && docker rm $container_id && docker rmi $tag
  echo "===> ROOTFS DONE"
}

function mkns() {
  ip netns add $NS_NAME
  ip netns exec $NS_NAME ip tuntap add name $TAP_NAME mode tap
  ip netns exec $NS_NAME ip link set $TAP_NAME up
  ip netns exec $NS_NAME ip addr add $TAP_ADDR$TAP_MASK dev $TAP_NAME

  echo "===> Namespace for Firecracker: $NS_NAME"
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
      "path_on_host": "$FC_ROOTFS",
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
      -d '{
              "snapshot_type": "Full",
              "snapshot_path": "./snapfile",
              "mem_file_path": "./memfile"
      }'
}

mkrootfs
mkns
startfc
sleep 10
pausefc
snapfc
kill $FC_PID
delns

echo "==== Output ========================================="
echo "| Code snippet ID:  $CODE_SNIPPET_ID"
echo "| Rootfs:           $FC_ROOTFS"
echo "| Snapfile:         $FC_SNAPFILE"
echo "| Memfile:          $FC_MEMFILE"
echo "====================================================="
echo
echo "===> Env Done"
