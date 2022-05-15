FROM alpine:3.14

RUN apk add --update util-linux openrc curl openssh iputils chrony

RUN rc-update add sshd

COPY provision.sh provision.sh

RUN chmod +x provision.sh
