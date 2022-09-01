# This Dockerfile is for creating a testing environment for devbookd.

FROM golang:1.18-alpine

RUN apk update && \
    apk upgrade && \
    apk add bash nodejs npm strace curl git graphviz make build-base

RUN CGO_ENABLED=0 go install github.com/go-delve/delve/cmd/dlv@latest

RUN CGO_ENABLED=0 go install github.com/google/pprof@latest

RUN curl -L https://github.com/qualified/lsp-ws-proxy/releases/download/v0.9.0-rc.4/lsp-ws-proxy_linux-musl.tar.gz > lsp-ws-proxy.tar.gz
RUN tar -zxvf lsp-ws-proxy.tar.gz
RUN mv lsp-ws-proxy /usr/bin/
RUN rm lsp-ws-proxy.tar.gz

RUN npm i -g typescript typescript-language-server prisma

WORKDIR /code

COPY debug/index.ts debug/tsconfig.json debug/.env* /code/

WORKDIR /code/prisma
COPY debug/schema.prisma schema.prisma

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

RUN make build-debug-devbookd
RUN mv /bin/devbookd-debug /usr/bin/devbookd

WORKDIR /
