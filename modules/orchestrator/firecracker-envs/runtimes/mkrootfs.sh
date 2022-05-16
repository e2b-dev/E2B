#! /usr/bin/bash

set -euo pipefail

TAG=rootfs

docker build -t $TAG .
#docker build -t $TAG -f - . <<EOF
#FROM alpine:3.14
#EOF

CONTAINER_ID=$(docker run -dt $TAG /bin/ash)
docker exec $CONTAINER_ID ./provision.sh

MOUNTDIR=mnt
FS=rootfs.ext4

SIZE=$(docker image inspect ${TAG}:latest --format='{{.Size}}')
FREE=50000000 # 50MB in B
TOTAL=$(($SIZE+$FREE))

echo Total: ${TOTAL}B

mkdir $MOUNTDIR
qemu-img create -f raw $FS ${TOTAL}B
mkfs.ext4 $FS
mount $FS $MOUNTDIR
docker cp $CONTAINER_ID:/ $MOUNTDIR

umount $MOUNTDIR
rm -rf $MOUNTDIR

docker kill $CONTAINER_ID && docker rm $CONTAINER_ID && docker rmi $TAG
