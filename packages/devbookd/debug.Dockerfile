# syntax = docker/dockerfile:1-experimental

# This Dockerfile is for creating a testing environment for devbookd.

FROM golang:1.19

RUN apt-get update
RUN apt-get install vim -y



# # RUN apk update && \
# #     apk upgrade && \
# #     apk add bash strace curl git graphviz make build-base

# RUN CGO_ENABLED=0 go install github.com/go-delve/delve/cmd/dlv@latest

# RUN CGO_ENABLED=0 go install github.com/google/pprof@latest

# # RUN curl -L https://github.com/qualified/lsp-ws-proxy/releases/download/v0.9.0-rc.4/lsp-ws-proxy_linux-musl.tar.gz > lsp-ws-proxy.tar.gz
# # RUN tar -zxvf lsp-ws-proxy.tar.gz
# # RUN mv lsp-ws-proxy /usr/bin/
# # RUN rm lsp-ws-proxy.tar.gz

# WORKDIR /code

# # COPY debug/index.ts debug/tsconfig.json debug/.env* debug/package.json /code/

# # RUN npm i

# # WORKDIR /code/prisma
# # COPY debug/schema.prisma schema.prisma

# # WORKDIR /code

# Set env vars for devbook-daemon
RUN echo RUN_CMD=bash >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=index.sh >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=index.sh >> /.dbkenv

WORKDIR /
COPY go.mod go.sum /
RUN go mod download

COPY ./ /

RUN --mount=type=cache,target=/root/.cache/go-build \
make build-debug-devbookd

RUN mv /bin/debug/devbookd /usr/bin/devbookd

WORKDIR /

RUN echo 'export PS1="\w \$ "' > /etc/profile.d/shell.sh
RUN echo 'export SHELL="/bin/bash"' >> /etc/profile.d/shell.sh

RUN apt-get install systemd -y

RUN mkdir -p /etc/systemd/system/multi-user.target.wants
RUN ln -s /etc/systemd/system/devbookd.service /etc/systemd/system/multi-user.target.wants/devbookd.service

RUN mkdir -p /etc/systemd/system/serial-getty@ttyS0.service.d

RUN echo $' \n\
[Service] \n\
ExecStart= \n\
ExecStart=-/sbin/agetty --noissue --autologin root %I 115200,38400,9600 vt102 \n\
' >  /etc/systemd/system/serial-getty@ttyS0.service.d/autologin.conf



RUN echo $' \n\
[Unit] \n\
Description=Devbook Daemon Service \n\
[Service] \n\
Type=simple \n\
Restart=always \n\
User=root \n\
Group=root \n\
ExecStart=/usr/bin/devbookd \n\
[Install] \n\
WantedBy=multi-user.target \n\
' > /etc/systemd/system/devbookd.service

RUN systemctl enable devbookd