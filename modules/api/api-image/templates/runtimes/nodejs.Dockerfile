FROM alpine:3.14

COPY provision.sh provision.sh
RUN chmod +x provision.sh

RUN apk add --update util-linux openrc nodejs npm

WORKDIR code
RUN npm init -y
RUN npm i {{ range .Deps }}{{ . }} {{ end }}

WORKDIR /
