# This Dockerfile is for creating a testing environment for devbookd.

FROM alpine:3.16

RUN apk add bash nodejs npm strace

RUN npm i -g typescript

COPY bin/devbookd /usr/bin/devbookd

WORKDIR code

# Set env vars for devbook-daemon
RUN echo RUN_CMD=bash >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=index.sh >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=index.sh >> /.dbkenv

WORKDIR /
