FROM ubuntu:20.04

RUN apt-get update
RUN apt-get install -y software-properties-common
RUN add-apt-repository ppa:longsleep/golang-backports
RUN apt-get update
RUN apt-get install -y build-essential
RUN apt-get install -y golang-9-go

WORKDIR /driver
COPY ./ /driver/

WORKDIR /driver
RUN PATH=$PATH:/usr/lib/go-1.19/bin  make build
