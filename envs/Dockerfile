FROM alpine:3.14

RUN apk add --update util-linux nodejs npm openrc git curl

RUN git clone https://github.com/plaid/quickstart.git

WORKDIR /quickstart

WORKDIR /quickstart/node

RUN npm i

WORKDIR /quickstart/frontend

RUN npm i

WORKDIR /quickstart

RUN curl https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-amd64.tgz -o ngrok.tar && tar xvzf ngrok.tar

RUN ["./ngrok", "authtoken", "277LXE0yZ0JGqTU7GZpiw7fGJN0_5hBENdnb5xmzBmJu18tBx"]

RUN apk del git curl

WORKDIR /

COPY provision.sh provision.sh

RUN chmod +x provision.sh