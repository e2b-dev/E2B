set -eu

# yes | unminimize

apt-get update

apt-get install -y \
  build-essential \
  curl socat util-linux openssh-server git chrony nano sudo htop

# Set up autologin.
mkdir /etc/systemd/system/serial-getty@ttyS0.service.d
cat <<EOF >/etc/systemd/system/serial-getty@ttyS0.service.d/autologin.conf
[Service]
ExecStart=
ExecStart=-/sbin/agetty --noissue --autologin root %I 115200,38400,9600 vt102
EOF

mkdir -p /etc/systemd/system

cat <<EOF >/etc/systemd/system/envd.service
[Unit]
Description=Env Daemon Service

[Service]
Type=simple
Restart=always
User=root
Group=root
Environment=GOTRACEBACK=all
LimitCORE=infinity
ExecStart=/usr/bin/bash -l -c "/usr/bin/envd"
OOMPolicy=continue
OOMScoreAdjust=-999

[Install]
WantedBy=multi-user.target
EOF

# Chrony configuration
mkdir -p /etc/chrony
echo "refclock PHC /dev/ptp0 poll -1 dpoll -1 offset 0 trust prefer" >/etc/chrony/chrony.conf
echo "makestep 1 -1" >>/etc/chrony/chrony.conf

# Add chrony to systemd
mkdir -p /etc/systemd/system/chrony.service.d
echo "[Service]" >/etc/systemd/system/chrony.service.d/override.conf
echo "ExecStart=" >>/etc/systemd/system/chrony.service.d/override.conf
echo "ExecStart=/usr/sbin/chronyd" >>/etc/systemd/system/chrony.service.d/override.conf

# --- Enable systemd services --- #
# Because this script runs in a container we can't use `systemctl`.
# Containers don't run init daemons. We have to enable the runner service manually.
mkdir -p /etc/systemd/system/multi-user.target.wants
ln -s /etc/systemd/system/envd.service /etc/systemd/system/multi-user.target.wants/envd.service
# ------------------------------- #

echo "export SHELL='/bin/bash'" >/etc/profile.d/shell.sh
echo "export PS1='\w \$ '" >/etc/profile.d/prompt.sh
echo "export PS1='\w \$ '" >>"/etc/profile"
echo "export PS1='\w \$ '" >>"/root/.bashrc"

mkdir -p /etc/ssh
touch /etc/ssh/sshd_config
echo "PermitRootLogin yes" >>/etc/ssh/sshd_config
echo "PermitEmptyPasswords yes" >>/etc/ssh/sshd_config
echo "PasswordAuthentication yes" >>/etc/ssh/sshd_config

# Remove password for root.
passwd -d root

# TODO: Change the directory for core dumps.
# bash -c 'echo "kernel.core_pattern=/tmp/%e.%t.%p.%s.core" > /proc/sys/kernel/core_pattern'

# Create default user.
adduser --disabled-password --gecos "" user
usermod -aG sudo user
passwd -d user
echo "user ALL=(ALL:ALL) NOPASSWD: ALL" >>/etc/sudoers

mkdir /code

chmod -R 777 /code
chmod -R 777 /home/user
# TODO: Right now the chown line has no effect in the FC, even though it correctly changes the owner here.
# It may be becayse of the way we are starting the FC VM?
# chown -R user:user /home/user

# Add DNS.
echo "nameserver 8.8.8.8" >/etc/resolv.conf

# Start systemd services
systemctl enable envd
systemctl enable chrony
