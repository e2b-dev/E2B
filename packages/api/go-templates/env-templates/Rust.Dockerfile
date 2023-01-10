FROM ubuntu:20.04

ARG DEBIAN_FRONTEND=noninteractive

COPY ./devbookd /usr/bin/devbookd
RUN chmod +x /usr/bin/devbookd
COPY ubuntu/devbookd.service /etc/init.d/devbookd

RUN mkdir -p /etc/chrony
RUN echo "refclock PHC /dev/ptp0 poll 3 dpoll -2 offset 0" > /etc/chrony/chrony.conf
RUN echo "makestep 1 -1" >> /etc/chrony/chrony.conf

COPY ubuntu/provision-env.ubuntu.sh /provision-env.sh
RUN chmod +x /provision-env.sh

# Update default packages
RUN apt-get update

# Get Ubuntu packages
RUN apt-get install -y \
    build-essential \
    curl socat util-linux openssh-server

# Get Rust
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y

RUN yes | unminimize

WORKDIR code

# Set env vars for devbook-daemon
RUN echo RUN_CMD=cargo >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=src/main.rs >> /.dbkenv

WORKDIR /
