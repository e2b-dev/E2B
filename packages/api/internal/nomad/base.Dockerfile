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
