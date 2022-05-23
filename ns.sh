#!/usr/bin/env bash

set -euo pipefail

# Change
# NS="6c258a8a-9304-4e82-a80b-aa2c0033abb0"
NS=ns$1
# VETH="veth4"
VETH=veth$1
# VETH_ADDR="10.0.3.1"
VETH_ADDR="10.0.$1.1"
# VPEER_ADDR="10.0.3.2"
VPEER_ADDR="10.0.$1.2"

# FC_HOST_IP="192.168.3.3"
FC_HOST_IP="192.168.$1.3"
#


MASK="/24"
VPEER="eth0"
FC_SNASPHOT_IP="169.254.0.21"

ip -n ${NS} link set lo up

ip -n ${NS} link add ${VETH} type veth peer name ${VPEER}
ip -n ${NS} addr add ${VPEER_ADDR}${MASK} dev ${VPEER}
ip -n ${NS} link set ${VPEER} up

ip -n ${NS} link set ${VETH} netns 1
ip link set ${VETH} up
ip addr add ${VETH_ADDR}${MASK} dev ${VETH}

ip -n ${NS} route add default via ${VETH_ADDR}


ip netns exec ${NS} iptables -t nat -A POSTROUTING -o ${VPEER} -s ${FC_SNASPHOT_IP} -j SNAT --to ${FC_HOST_IP}
ip netns exec ${NS} iptables -t nat -A PREROUTING -i ${VPEER} -d ${FC_HOST_IP} -j DNAT --to ${FC_SNASPHOT_IP}
ip route add ${FC_HOST_IP} via ${VPEER_ADDR}


iptables -A FORWARD -i ${VETH} -o ens4 -j ACCEPT
iptables -A FORWARD -i ens4 -o ${VETH} -j ACCEPT
iptables -t nat -A POSTROUTING -s ${FC_HOST_IP}/32 -o ens4 -j MASQUERADE


# mkdir -p "/etc/netns/$NS"
# ln -s /run/systemd/resolve/resolv.conf /etc/netns/"$NS"/resolv.conf

# curl --unix-socket /tmp/firecracker$1.socket -i \
#      -X PUT "http://localhost/drives/rootfs" \
#      -H "accept: application/json" \
#      -H "Content-Type: application/json" \
#      -d "{
#              \"drive_id\": \"rootfs\",
#              \"path_on_host\": \"/fc-vm/rootfs-n.ext4\",
#              \"is_root_device\": true,
#              \"is_read_only\": false
#          }"

# BASEIMAGE=/fc-root/rootfs.ext4

# mkdir -p /fc-over/${1} 
# OVERLAY=/fc-over/${1}/overlay.ext4


# qemu-img create -f raw $OVERLAY 1000M

# OVERLAY_SZ=`blockdev --getsz $OVERLAY`

# LOOP=$(losetup --find --show --read-only $BASEIMAGE)
# dmsetup create mybase

# curl --unix-socket /tmp/firecracker$1.socket -i \
#     -X PUT 'http://localhost/snapshot/load' \
#     -H  'Accept: application/json' \
#     -H  'Content-Type: application/json' \
#     -d '{
#             "snapshot_path": "/fc-root/snapshot_file",
#             "mem_file_path": "/fc-root/mem_file",
#             "enable_diff_snapshots": false,
#             "resume_vm": true
#     }'


curl --unix-socket /tmp/.firecracker.sock-32137-651 -i \
    -X PUT 'http://localhost/snapshot/load' \
    -H  'Accept: application/json' \
    -H  'Content-Type: application/json' \
    -d '{
            "snapshot_path": "/mnt/disks/fc-envs/test/snapfile",
            "mem_file_path": "/mnt/disks/fc-envs/test/memfile",
            "enable_diff_snapshots": false,
            "resume_vm": true
    }'
