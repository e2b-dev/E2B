# You can use most of the Debian based images
FROM ubuntu:latest

COPY test.txt /test.txt

# Install the ffmpeg tool/
RUN apt update \
    && apt install -y ffmpeg
