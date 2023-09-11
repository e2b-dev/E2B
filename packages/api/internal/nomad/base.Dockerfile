FROM ubuntu:22.04

ARG DEBIAN_FRONTEND=noninteractive

# Update default packages
RUN apt-get update

# Get Ubuntu packages
RUN apt-get install -y \
    build-essential \
    curl socat util-linux openssh-server git chrony nano sudo htop

# Unminimize ubuntu so it can be used in an interactive way
RUN yes | unminimize

# Prepare the provisioning script
COPY ubuntu/provision-env.ubuntu.sh /provision-env.sh
RUN chmod +x /provision-env.sh

# Prepare the envd binary
COPY ./envd /usr/bin/envd
RUN chmod +x /usr/bin/envd

# Add envd to systemd
RUN mkdir -p /etc/systemd/system
COPY ubuntu/envd.service /etc/systemd/system/envd.service

# Chrony configuration
RUN mkdir -p /etc/chrony
RUN echo "refclock PHC /dev/ptp0 poll -1 dpoll -1 offset 0 trust prefer" > /etc/chrony/chrony.conf
RUN echo "makestep 1 -1" >> /etc/chrony/chrony.conf

# Add chrony to systemd
RUN mkdir -p /etc/systemd/system/chrony.service.d
RUN echo "[Service]" > /etc/systemd/system/chrony.service.d/override.conf
RUN echo "ExecStart=" >> /etc/systemd/system/chrony.service.d/override.conf
RUN echo "ExecStart=/usr/sbin/chronyd" >> /etc/systemd/system/chrony.service.d/override.conf
