FROM ubuntu:22.04

ARG DEBIAN_FRONTEND=noninteractive

# Update default packages
RUN apt-get update

# Get Ubuntu packages
RUN apt-get install -y \
    build-essential \
    curl socat util-linux openssh-server git chrony nano sudo

# Unminimize ubuntu so it can be used in an interactive way
RUN yes | unminimize

# Prepare the provisioning script
COPY ubuntu/provision-env.ubuntu.sh /provision-env.sh
RUN chmod +x /provision-env.sh

# Prepare the devbookd binary
COPY ./devbookd /usr/bin/devbookd
RUN chmod +x /usr/bin/devbookd

# Add devbookd to systemd
RUN mkdir -p /etc/systemd/system
COPY ubuntu/devbookd.service /etc/systemd/system/devbookd.service

# Chrony configuration
RUN mkdir -p /etc/chrony
RUN echo "refclock PHC /dev/ptp0 poll -1 dpoll -1 offset 0 trust prefer" > /etc/chrony/chrony.conf
RUN echo "makestep 1 -1" >> /etc/chrony/chrony.conf

# Add chrony to systemd
RUN mkdir -p /etc/systemd/system/chrony.service.d
RUN echo "[Service]" > /etc/systemd/system/chrony.service.d/override.conf
RUN echo "ExecStart=" >> /etc/systemd/system/chrony.service.d/override.conf
RUN echo "ExecStart=/usr/sbin/chronyd" >> /etc/systemd/system/chrony.service.d/override.conf
