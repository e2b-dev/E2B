CONTAINER_ID=ff9b97bfb9e7

MOUNTDIR=mnt
FS=rootfs-new.ext4

mkdir $MOUNTDIR
qemu-img create -f raw $FS 1200M
mkfs.ext4 $FS
mount $FS $MOUNTDIR
docker cp $CONTAINER_ID:/ $MOUNTDIR
umount $MOUNTDIR
# rm -rf $MOUNTDIR

# docker stop $CONTAINER_ID