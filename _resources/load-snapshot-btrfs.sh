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

WORKDIR="/mnt/disks/fc-envs/${CODE_SNIPPET_ID}"
BUILD_ID=`cat build_id`
mkdir builds/${BUILD_ID} > /dev/null 2>&1 || true

rm -rf $TMP
mkdir -p $TMP

ROOTFS=$TMP/rootfs.ext4

# Don't use relative soft link
ln -s ${WORKDIR}/test/snapshots/rootfs-2/rootfs.ext4 $ROOTFS

# FC
FC_SOCKET="/tmp/firecracker.socket"

rm $FC_SOCKET > /dev/null 2>&1 || true

echo "Mounting on ${TMP}, ./builds/${BUILD_ID}"

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
