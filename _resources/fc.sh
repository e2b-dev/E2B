#!/usr/bin/env bash

set -euo pipefail

TAP_DEV="tap0"

NS=ns$1

MASK_LONG="255.255.255.252"
MASK_SHORT="/30"
FC_IP="169.254.0.21"
TAP_IP="169.254.0.22"
FC_MAC="02:FC:00:00:00:05"

KERNEL_BOOT_ARGS="console=ttyS0 ip=${FC_IP}::${TAP_IP}:${MASK_LONG}::eth0:off ipv6.disable=1 i8042.noaux i8042.nomux i8042.nopnp i8042.dumbkb d8250.nr_uarts=0 noapic reboot=k panic=1 pci=off nomodules random.trust_cpu=on systemd.unified_cgroup_hierarchy=0"

# set up a tap network interface for the Firecracker VM to user
ip -n ${NS} link del "$TAP_DEV" 2> /dev/null || true
ip -n ${NS} tuntap add dev "$TAP_DEV" mode tap
# sysctl -w net.ipv4.conf.${TAP_DEV}.proxy_arp=1 > /dev/null
# sysctl -w net.ipv6.conf.${TAP_DEV}.disable_ipv6=1 > /dev/null
ip -n ${NS} addr add "${TAP_IP}${MASK_SHORT}" dev "$TAP_DEV"
ip -n ${NS} link set dev "$TAP_DEV" up

# make a configuration file
cat <<EOF > vmconfig.json
{
  "boot-source": {
    "kernel_image_path": "/fc-vm/vmlinux.bin",
    "boot_args": "$KERNEL_BOOT_ARGS"
  },
  "drives":[
   {
      "drive_id": "rootfs",
      "path_on_host": "/fc-vm/rootfs.ext4",
      "is_root_device": true,
      "is_read_only": false
    }
  ],
  "network-interfaces": [
      {
          "iface_id": "eth0",
          "guest_mac": "$FC_MAC",
          "host_dev_name": "$TAP_DEV"
      }
  ],
  "machine-config": {
    "vcpu_count": 1,
    "mem_size_mib": 256
  }
}
EOF
# start firecracker
ip netns exec ${NS} firecracker --api-sock /tmp/firecracker$1.socket --config-file vmconfig.json