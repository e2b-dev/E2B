FROM alpine:3.14

RUN apk add --update util-linux openrc openssh
RUN apk add nodejs npm

COPY devbookd /usr/bin/devbookd
COPY devbookd-init /etc/init.d/devbookd
COPY provision-env.sh provision-env.sh
RUN chmod +x provision-env.sh

WORKDIR code
RUN npm init -y
RUN npm i {{ range .Deps }}{{ . }} {{ end }}

WORKDIR /
