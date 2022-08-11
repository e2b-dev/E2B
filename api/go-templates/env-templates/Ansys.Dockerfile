FROM ubuntu:20.04

ARG DEBIAN_FRONTEND=noninteractive
RUN apt update -y
RUN apt install -y \
  build-essential \
  zlib1g-dev \
  libncurses5-dev \
  libgdbm-dev \
  libnss3-dev \
  libssl-dev \
  libreadline-dev \
  libffi-dev \
  ffmpeg \
  libsm6 \
  libxext6 \
  openssh-server \
  wget \
  python3-pip

COPY devbookd /usr/bin/devbookd
COPY ubuntu/devbookd.service /etc/systemd/system/devbookd.service

COPY ubuntu/provision-env.ubuntu.sh /provision-env.sh
RUN chmod +x /provision-env.sh

RUN python3 -m pip install -U --force-reinstall pip

WORKDIR /code
RUN touch main.py
RUN pip install ansys-mapdl-core

# Set env vars for devbook-daemon
RUN echo RUN_CMD=python3 >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=main.py >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=main.py >> /.dbkenv

WORKDIR /
