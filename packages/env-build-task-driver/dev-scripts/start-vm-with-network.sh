set -euo xtrace pipefail

TAP_DEV="tap0"
IFACE="eth0"
# This is specific to the provider (AWS, GCP)
GATEWAY="enp126s0"

MASK_LONG="255.255.255.252"
MASK_SHORT="/30"
TAP_IP="172.16.0.1"
FC_IP="172.16.0.2"
FC_MAC="06:00:AC:10:00:02"

sudo sh -c "echo 1 > /proc/sys/net/ipv4/ip_forward"

# cleanup
ip link del "$TAP_DEV" || true

ip tuntap add dev "$TAP_DEV" mode tap
ip addr add "${TAP_IP}${MASK_SHORT}" dev "$TAP_DEV"
ip link set dev "$TAP_DEV" up

# cleanup
sudo iptables -F

iptables -t nat -A POSTROUTING -s $TAP_IP$MASK_SHORT -o $GATEWAY -j MASQUERADE
iptables -A FORWARD -i $TAP_DEV -o $GATEWAY -j ACCEPT
iptables -A FORWARD -i $GATEWAY -o $TAP_DEV -j ACCEPT
sudo iptables -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT

KERNEL_BOOT_ARGS="console=ttyS0 ip=${FC_IP}::${TAP_IP}:${MASK_LONG}::eth0:off reboot=k panic=1 pci=off"

cat <<EOF >vmconfig.json
{
  "boot-source": {
    "kernel_image_path": "./vmlinux-5.10.204",
    "boot_args": "$KERNEL_BOOT_ARGS"
  },
  "drives":[
   {
      "drive_id": "rootfs",
      "path_on_host": "./ubuntu-22.04.ext4",
      "is_root_device": true,
      "is_read_only": false
    }
  ],
  "network-interfaces": [
      {
          "iface_id": "$IFACE",
          "guest_mac": "$FC_MAC",
          "host_dev_name": "$TAP_DEV"
      }
  ],
  "machine-config": {
    "vcpu_count": 2,
    "smt": true,
    "mem_size_mib": 512
  }
}
EOF

./firecracker --no-api --config-file vmconfig.json

# Run inside guest
# ip route add default via 172.16.0.1 dev eth0
