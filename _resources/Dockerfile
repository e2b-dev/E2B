FROM alpine:3.14

RUN apk add --update util-linux nodejs npm openrc git curl openssh

RUN rc-update add sshd

RUN git clone https://github.com/plaid/quickstart.git

WORKDIR /quickstart

WORKDIR /quickstart/node

RUN npm i

WORKDIR /quickstart/frontend

WORKDIR /quickstart

RUN apk del git

WORKDIR /

COPY sshd_config /etc/ssh/sshd_config

COPY provision.sh provision.sh

RUN chmod +x provision.sh
