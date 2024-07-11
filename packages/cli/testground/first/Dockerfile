FROM ubuntu:latest

RUN apt update \
    && apt install curl -y

RUN curl -s https://e2b.dev/docs/sandbox/templates/template-file > template-file-guide.html

RUN echo "Fetched the template file guide."