set -eu

# NETWORK
NAMESPACE="ns1"

TAP_DEV="tap0"
MASK_LONG="255.255.255.252"
MASK_SHORT="/30"
TAP_IP="169.254.0.22"

ip netns add $NAMESPACE > /dev/null 2>&1 || true
ip -n $NAMESPACE link del "$TAP_DEV" 2> /dev/null > /dev/null 2>&1 || true
ip -n $NAMESPACE tuntap add dev "$TAP_DEV" mode tap
ip -n $NAMESPACE addr add "${TAP_IP}${MASK_SHORT}" dev "$TAP_DEV"
ip -n $NAMESPACE link set dev "$TAP_DEV" up

# FILESYSTEM
CODE_SNIPPET_ID="moiGcf40TPsT"
TMP="/tmp/${NAMESPACE}"

cd /mnt/disks/fc-envs/${CODE_SNIPPET_ID}
BUILD_ID=`cat build_id`
mkdir builds/${BUILD_ID} > /dev/null 2>&1 || true

rm -rf $TMP
mkdir -p $TMP

# NAME=$NAMESPACE
# DM_BASE=$NAMESPACE-base
# DM_OVERLAY=$NAMESPACE-overlay

# dmsetup remove $DM_OVERLAY > /dev/null 2>&1 || true
# dmsetup remove $DM_BASE > /dev/null 2>&1 || true

# BASE=./rootfs.ext4
# OVERLAY=$TMP/overlay.ext4
# ROOTFS=$TMP/rootfs.ext4

# qemu-img create -f raw $OVERLAY 200M
# OVERLAY_SIZE=`blockdev --getsz $OVERLAY`

# BASE_LOOP=$(losetup --find --show --read-only $BASE)
# BASE_SIZE=`blockdev --getsz $BASE`

# # printf "0 2645602 linear /dev/loop25 0\n2645602 409600 zero" | dmsetup create ns1-base

# printf "0 $BASE_SIZE linear $BASE_LOOP 0\n$BASE_SIZE $OVERLAY_SIZE zero" | dmsetup create $DM_BASE

# OVERLAY_LOOP=$(losetup --find --show $OVERLAY)

# echo "0 $OVERLAY_SIZE snapshot /dev/mapper/${DM_BASE} $OVERLAY_LOOP P 8" | dmsetup create $DM_OVERLAY

# losetup --detach $BASE_LOOP
# losetup --detach $OVERLAY_LOOP

# ln -s /dev/mapper/$DM_OVERLAY $ROOTFS
855716
852336

BASEIMAGE=./rootfs.ext4
OVERLAY=$TMP/overlay.ext4
ROOTFS=$TMP/rootfs.ext4

dmsetup remove myoverlay > /dev/null 2>&1 || true
dmsetup remove mybase > /dev/null 2>&1 || true

# Step 1: Create an empty image
# I also tried to create the image with fallocate but it didn't work as well

qemu-img create -f raw $OVERLAY 1500M
OVERLAY_SZ=`blockdev --getsz $OVERLAY`

# Step 2: Create a loop device for the BASEIMAGE file (like /dev/loop16)
LOOP=$(losetup --find --show --read-only $BASEIMAGE)
SZ=`blockdev --getsz $BASEIMAGE`

# Step 3: Create /dev/mapper/mybase
printf "0 $SZ linear $LOOP 0\n$SZ $OVERLAY_SZ zero"  | dmsetup create mybase

# Step 4: Create another loop device for the OVERLAY file
LOOP2=$(losetup --find --show $OVERLAY)

# Step 5: Create the final device mapper
echo "0 $OVERLAY_SZ snapshot /dev/mapper/mybase $LOOP2 P 8" | dmsetup create myoverlay

losetup --detach $LOOP
losetup --detach $LOOP2


ln -s /dev/mapper/myoverlay $ROOTFS


# FC
FC_SOCKET="/tmp/firecracker.socket"

rm $FC_SOCKET > /dev/null 2>&1 || true

unshare -pfm --kill-child -- bash -c "mount --bind ${TMP} ./builds/${BUILD_ID} && ip netns exec ${NAMESPACE} firecracker --api-sock ${FC_SOCKET}" &

sleep 0.3

time curl --unix-socket $FC_SOCKET -i \
    -X PUT 'http://localhost/snapshot/load' \
    -H  'Accept: application/json' \
    -H  'Content-Type: application/json' \
    -d "{
            \"snapshot_path\": \"/mnt/disks/fc-envs/${CODE_SNIPPET_ID}/snapfile\",
            \"mem_file_path\": \"/mnt/disks/fc-envs/${CODE_SNIPPET_ID}/memfile\",
            \"enable_diff_snapshots\": false,
            \"resume_vm\": true
    }"
