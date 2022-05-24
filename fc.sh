NS=ns$1

ip netns add ${NS}



MOUNT_CMD="mkdir /fc-${1}; mount -t overlay overlay -o lowerdir=/fc-root,upperdir=/fc-${1},workdir=/fc-work /fc-vm;"
FC_CMD="ip netns exec ${NS} firecracker --api-sock /tmp/firecracker$1.socket;"

unshare -m sh -c "${MOUNT_CMD}${FC_CMD}"






# unshare -m

# mount --bind /fc-vm-removed /fc-vm
# mount -t overlay overlay \
#       -o lowerdir=/home/bork/test/lower,upperdir=/home/bork/test/upper,workdir=/home/bork/test/work /home/bork/test/merged

# jailer \
#   --id 551e7604-e35c-42b3-b825-416853441234 \
#   --cgroup cpuset.mems=0 \
#   --cgroup cpuset.cpus=$(cat /sys/devices/system/node/node0/cpulist) \
#   --exec-file /usr/bin/firecracker \
#   --uid 123 \
#   --gid 100 \
#   --netns /var/run/netns/${NS} \
#   --daemonize

# mkdir -p /overlay
# mount -t squashfs /cdrom/casper/ubuntu.overlay /overlay

# # Try squashfs
# mkdir /fc-vm
# mount -t tmpfs -o noatime,mode=0755 tmpfs /fc-vm
# mount -t overlay -o lowerdir=/fc-vm-removed,upperdir=/fc-vm overlay /fc-vm


# mount -t overlay overlay -o lowerdir=/fc-root,upperdir=/fc-id,workdir=/fc-work /fc-vm
