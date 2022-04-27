#!/bin/bash

# https://cloud.google.com/compute/docs/disks/add-persistent-disk
# https://wiki.archlinux.org/index.php/Fstab

set -e

DEVICE_PATH=$(realpath /dev/disk/by-id/$1)
MNT_DIR=${2:-data}

echo "DEVICE_PATH: $DEVICE_PATH"
echo "MNT_DIR:     $MNT_DIR"

if sudo blkid $DEVICE_PATH; then
    echo "device $DEVICE_PATH already mount"
    sudo df -Th
    exit
else
    sudo mkfs.ext4 -m 0 -F -E lazy_itable_init=0,lazy_journal_init=0,discard $DEVICE_PATH
    sudo mkdir -p /mnt/disks/$MNT_DIR
    sudo mount -o discard,defaults /dev/sdb /mnt/disks/$MNT_DIR
    sudo chmod a+w /mnt/disks/$MNT_DIR
    echo UUID=$(sudo blkid -s UUID -o value $DEVICE_PATH) /mnt/disks/$MNT_DIR ext4 discard,defaults,nofail 0 2 | sudo tee -a /etc/fstab
    cat /etc/fstab
    sudo df -Th
fi
