FROM ubuntu:latest

RUN apt-get update && apt-get install -y curl

RUN curl -s https://e2b.dev/docs/sandbox/templates/template-file| \
    > template-file.html

RUN cat template-file.html
