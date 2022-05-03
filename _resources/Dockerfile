FROM alpine:3.14

RUN apk add --update util-linux nodejs npm openrc git curl

RUN git clone https://github.com/plaid/quickstart.git

WORKDIR /quickstart

WORKDIR /quickstart/node

WORKDIR /quickstart/frontend

RUN npm i

WORKDIR /quickstart

RUN apk del git curl

WORKDIR /

COPY provision.sh provision.sh

RUN chmod +x provision.sh
