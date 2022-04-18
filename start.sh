set -eu

# download a kernel and filesystem image
# [ -e vmlinux.bin ] || wget https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux.bin
# [ -e bionic.rootfs.ext4 ] || wget https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/rootfs/bionic.rootfs.ext4
# [ -e hello-id_rsa ] || wget -O hello-id_rsa https://raw.githubusercontent.com/firecracker-microvm/firecracker-demo/ec271b1e5ffc55bd0bf0632d5260e96ed54b5c0c/xenial.rootfs.id_rsa

TAP_DEV="fc-88-tap0"

# set up the kernel boot args
MASK_LONG="255.255.255.252"
MASK_SHORT="/30"
FC_IP="169.254.0.21"
TAP_IP="169.254.0.22"
FC_MAC="02:FC:00:00:00:05"


# kernel -  8250.nr_uarts=0 quiet
# KERNEL_BOOT_ARGS="ip=${FC_IP}::${TAP_IP}:${MASK_LONG}::eth0:off console=ttyS0 panic=1 pci=off random.trust_cpu=on"
# KERNEL_BOOT_ARGS="${KERNEL_BOOT_ARGS} ip=${FC_IP}::${TAP_IP}:${MASK_LONG}::eth0:off"
KERNEL_BOOT_ARGS="console=ttyS0 ip=${FC_IP}::${TAP_IP}:${MASK_LONG}::eth0:off ipv6.disable=1 i8042.noaux i8042.nomux i8042.nopnp i8042.dumbkb d8250.nr_uarts=0 noapic reboot=k panic=1 pci=off nomodules random.trust_cpu=on systemd.unified_cgroup_hierarchy=0"

# set up a tap network interface for the Firecracker VM to user
ip link del "$TAP_DEV" 2> /dev/null || true
ip tuntap add dev "$TAP_DEV" mode tap
sysctl -w net.ipv4.conf.${TAP_DEV}.proxy_arp=1 > /dev/null
sysctl -w net.ipv6.conf.${TAP_DEV}.disable_ipv6=1 > /dev/null
ip addr add "${TAP_IP}${MASK_SHORT}" dev "$TAP_DEV"
ip link set dev "$TAP_DEV" up

# make a configuration file
cat <<EOF > vmconfig.json
{
  "boot-source": {
    "kernel_image_path": "/fc/vmlinux",
    "boot_args": "$KERNEL_BOOT_ARGS"
  },
  "drives":[
   {
      "drive_id": "rootfs",
      "path_on_host": "rootfs-new.ext4",
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
    "vcpu_count": 2,
    "mem_size_mib": 1024,
    "ht_enabled": false
  }
}
EOF
# start firecracker
firecracker --api-sock /tmp/firecracker.socket --config-file vmconfig.json