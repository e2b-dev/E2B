FROM ubuntu:22.04

ARG DEBIAN_FRONTEND=noninteractive

COPY ./devbookd /usr/bin/devbookd
RUN chmod +x /usr/bin/devbookd
RUN mkdir -p /etc/systemd/system
COPY ubuntu/devbookd.service /etc/systemd/system/devbookd.service

RUN mkdir -p /etc/chrony
RUN echo "refclock PHC /dev/ptp0 poll 1 dpoll -2 offset 0" > /etc/chrony/chrony.conf
RUN echo "makestep 1 -1" >> /etc/chrony/chrony.conf

COPY ubuntu/provision-env.ubuntu.sh /provision-env.sh
RUN chmod +x /provision-env.sh

# Update default packages
RUN apt-get update

# Get Ubuntu packages
RUN apt-get install -y \
    build-essential \
    curl socat util-linux openssh-server git

RUN yes | unminimize
