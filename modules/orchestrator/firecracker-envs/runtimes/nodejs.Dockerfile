FROM alpine:3.14
RUN apk add --update util-linux openrc nodejs npm

# TODO: Install nodejs deps

COPY provision.sh provision.sh
RUN chmod +x provision.sh
