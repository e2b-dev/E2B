#! /bin/ash

# This script is supposed to be executed in a running *Alpine* container.
# The container is then extracted to a rootfs image for the Firecracker VM.

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
rc-update add local default
rc-update add sshd
rc-update add devbookd
rc-update add chronyd

echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
echo "PermitEmptyPasswords yes" >> /etc/ssh/sshd_config
echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config

# Remove password for root.
passwd -d root

# Add DNS.
echo "nameserver 8.8.8.8" > /etc/resolv.conf

# Change terminal prompt
sed -i.bak '/^export PS1/i PS1="\\w $ "' "/etc/profile"

# Delete itself once done.
rm -- "$0"
