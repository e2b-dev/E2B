set -eu

TAP_DEV="tap0"

# set up the kernel boot args
MASK_LONG="255.255.255.252"
MASK_SHORT="/30"
FC_IP="169.254.0.21"
TAP_IP="169.254.0.22"
FC_MAC="02:FC:00:00:00:05"

BUILD_ID="0eed8a13-7ef9-41c1-a194-8b076b5ed12b"
CODE_SNIPPET_ID="0jPx0FaEApbv"

KERNEL_BOOT_ARGS="console=ttyS0 ip=${FC_IP}::${TAP_IP}:${MASK_LONG}::eth0:off ipv6.disable=1 i8042.noaux i8042.nomux i8042.nopnp i8042.dumbkb d8250.nr_uarts=0 noapic reboot=k panic=1 pci=off nomodules random.trust_cpu=on systemd.unified_cgroup_hierarchy=0"

# set up a tap network interface for the Firecracker VM to user
ip -n ns1 link del "$TAP_DEV" 2> /dev/null || true
ip -n ns1 tuntap add dev "$TAP_DEV" mode tap
# sysctl -w net.ipv4.conf.${TAP_DEV}.proxy_arp=1 > /dev/null
# sysctl -w net.ipv6.conf.${TAP_DEV}.disable_ipv6=1 > /dev/null
ip -n ns1 addr add "${TAP_IP}${MASK_SHORT}" dev "$TAP_DEV"
ip -n ns1 link set dev "$TAP_DEV" up

mkdir builds/${BUILD_ID} || true
mkdir overlay || true
mkdir workdir || true

rm /tmp/firecracker.socket || true

# start firecracker
unshare -pfm --kill-child -- bash -c "mount -t overlay overlay -o lowerdir=./,upperdir=./overlay,workdir=./workdir ./builds/${BUILD_ID} && ip netns exec ns1 firecracker --api-sock /tmp/firecracker.socket" &

sleep 0.3

time curl --unix-socket /tmp/firecracker.socket -i \
    -X PUT 'http://localhost/snapshot/load' \
    -H  'Accept: application/json' \
    -H  'Content-Type: application/json' \
    -d "{
            \"snapshot_path\": \"/mnt/disks/fc-envs/${CODE_SNIPPET_ID}/snapfile\",
            \"mem_file_path\": \"/mnt/disks/fc-envs/${CODE_SNIPPET_ID}/memfile\",
            \"enable_diff_snapshots\": false,
            \"resume_vm\": true
    }"
