#! /bin/ash

set -euo pipefail

# Set up a login terminal on the serial console (ttyS0):
ln -s agetty /etc/init.d/agetty.ttyS0
echo ttyS0 > /etc/securetty

echo agetty_options="\"--autologin root --noclear\"" > /etc/conf.d/agetty.ttyS0

rc-update add agetty.ttyS0 default

# Make sure special file systems are mounted on boot:
rc-update add devfs boot
rc-update add procfs boot
rc-update add sysfs boot

# Remove password for root.
passwd -d root

# Add DNS
echo "nameserver 8.8.8.8" > /etc/resolv.conf

# TODO: Start dbkd and add it to openrc version of systemd os it is always running

# Delete itself once done.
rm -- "$0"
