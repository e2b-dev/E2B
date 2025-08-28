FROM alpine:latest
COPY package.json /app/
COPY src/index.js ./src/
COPY config.json /etc/app/config.json