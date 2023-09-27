#! /bin/bash

# This script is supposed to be executed in a running *Ubuntu* container.
# The container is then extracted to a rootfs image for the Firecracker VM.

set -euo pipefail

# TODO: Add swap

# Set up autologin.
mkdir /etc/systemd/system/serial-getty@ttyS0.service.d
cat <<EOF >/etc/systemd/system/serial-getty@ttyS0.service.d/autologin.conf
[Service]
ExecStart=
ExecStart=-/sbin/agetty --noissue --autologin root %I 115200,38400,9600 vt102
EOF

# --- Enable systemd services --- #
# Because this script runs in a container we can't use `systemctl`.
# Containers don't run init daemons. We have to enable the runner service manually.
mkdir -p /etc/systemd/system/multi-user.target.wants
ln -s /etc/systemd/system/devbookd.service /etc/systemd/system/multi-user.target.wants/devbookd.service
# ------------------------------- #

echo "export SHELL='/bin/bash'" >/etc/profile.d/shell.sh
echo "export PS1='\w \$ '" >/etc/profile.d/prompt.sh
echo "export PS1='\w \$ '" >>"/etc/profile"
echo "export PS1='\w \$ '" >>"/root/.bashrc"

# Use .bashrc and .profile
echo "if [ -f ~/.bashrc ]; then source ~/.bashrc; fi; if [ -f ~/.profile ]; then source ~/.profile; fi" >> /etc/profile


mkdir -p /etc/ssh
touch /etc/ssh/sshd_config
echo "PermitRootLogin yes" >>/etc/ssh/sshd_config
echo "PermitEmptyPasswords yes" >>/etc/ssh/sshd_config
echo "PasswordAuthentication yes" >>/etc/ssh/sshd_config

# Remove password for root.
passwd -d root

# TODO: Change the directory for core dumps.
# bash -c 'echo "kernel.core_pattern=/tmp/%e.%t.%p.%s.core" > /proc/sys/kernel/core_pattern'

# Create defaul user.
adduser --disabled-password --gecos "" user
usermod -aG sudo user
passwd -d user
echo "user ALL=(ALL:ALL) NOPASSWD: ALL" >>/etc/sudoers

chmod 777 /home/user
chmod 777 -R /usr/local/

# TODO: Right now the chown line has no effect in the FC, even though it correctly changes the owner here.
# It may be becayse of the way we are starting the FC VM?
# chown -R user:user /home/user

# Add DNS.
echo "nameserver 8.8.8.8" >/etc/resolv.conf

# Start systemd services
systemctl enable devbookd
systemctl enable chrony

# Delete itself once done.
rm -- "$0"
