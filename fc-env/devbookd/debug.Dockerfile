# This Dockerfile is for creating a testing environment for devbookd.

FROM rhaps1071/golang-1.14-alpine-git

RUN apk add bash nodejs npm strace

RUN CGO_ENABLED=0 go get -ldflags "-s -w -extldflags '-static'" github.com/go-delve/delve/cmd/dlv

RUN npm i -g typescript

WORKDIR /code

# Set env vars for devbook-daemon
RUN echo RUN_CMD=bash >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=index.sh >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=index.sh >> /.dbkenv

COPY bin/devbookd-debug /usr/bin/devbookd

WORKDIR /
