export BASH_XTRACEFD=1
set -euo xtrace pipefail

echo "Starting provisioning script."

echo "ENV_ID=$1" > /.e2b
echo "BUILD_ID=$2" >> /.e2b

# We are downloading the packages manually
apt-get update --download-only
DEBIAN_FRONTEND=noninteractive DEBCONF_NOWARNINGS=yes apt-get install -y openssh-server chrony sudo systemd socat

# Set up autologin.
mkdir -p /etc/systemd/system/serial-getty@ttyS0.service.d
cat <<EOF >/etc/systemd/system/serial-getty@ttyS0.service.d/autologin.conf
[Service]
ExecStart=
ExecStart=-/sbin/agetty --noissue --autologin root %I 115200,38400,9600 vt102
EOF

# Set up envd service.
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

# Set up chrony.
mkdir -p /etc/chrony
cat <<EOF >/etc/chrony/chrony.conf
refclock PHC /dev/ptp0 poll -2 dpoll -2 offset 0 trust prefer
makestep 1 -1
EOF

mkdir -p /etc/systemd/system/chrony.service.d
cat <<EOF >/etc/systemd/system/chrony.service.d/override.conf
[Service]
ExecStart=
ExecStart=/usr/sbin/chronyd
EOF

# Enable systemd services
# Because this script runs in a container we can't use `systemctl`.
# Containers don't run init daemons. We have to enable the runner service manually.
mkdir -p /etc/systemd/system/multi-user.target.wants
ln -s /etc/systemd/system/envd.service /etc/systemd/system/multi-user.target.wants/envd.service

# Set up shell.
echo "export SHELL='/bin/bash'" >/etc/profile.d/shell.sh
echo "export PS1='\w \$ '" >/etc/profile.d/prompt.sh
echo "export PS1='\w \$ '" >>"/etc/profile"
echo "export PS1='\w \$ '" >>"/root/.bashrc"

# Use .bashrc and .profile
echo "if [ -f ~/.bashrc ]; then source ~/.bashrc; fi; if [ -f ~/.profile ]; then source ~/.profile; fi" >>/etc/profile

# Set up SSH.
mkdir -p /etc/ssh
cat <<EOF >>/etc/ssh/ssh_config
PermitRootLogin yes
PermitEmptyPasswords yes
PasswordAuthentication yes
EOF

# Remove password for root.
passwd -d root

# Create default user.
adduser --disabled-password --gecos "" user
usermod -aG sudo user
passwd -d user
echo "user ALL=(ALL:ALL) NOPASSWD: ALL" >>/etc/sudoers

mkdir -p /code
mkdir -p /home/user

chmod 777 -R /home/user
chmod 777 -R /usr/local
chmod 777 -R /code

# TODO: Right now the chown line has no effect in the FC, even though it correctly changes the owner here.
# It may be becayse of the way we are starting the FC VM?

# Add DNS.
echo "nameserver 8.8.8.8" >/etc/resolv.conf

# Start systemd services
systemctl enable envd
systemctl enable chrony 2>&1

echo "Finished provisioning script"
