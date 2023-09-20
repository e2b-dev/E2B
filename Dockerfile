FROM ubuntu:22.04

RUN apt-get update

RUN apt-get install -y build-essential curl socat util-linux openssh-server git chrony nano sudo htop
