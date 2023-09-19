FROM ubuntu:22.04

# avoid asking for input
ARG DEBIAN_FRONTEND=noninteractive 

# Update default packages
RUN apt-get update

# Get Ubuntu packages
RUN apt-get install -y \
    build-essential \
    curl socat util-linux openssh-server git chrony nano sudo htop

RUN curl -sL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs

WORKDIR /code

RUN npm init -y
