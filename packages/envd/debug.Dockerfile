FROM golang:1.21

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update
RUN apt-get install systemd ca-certificates make python-is-python3 python3 nodejs -y

RUN update-ca-certificates

RUN useradd -ms /bin/bash user

WORKDIR /

RUN mkdir -p /etc/systemd/system/multi-user.target.wants
RUN ln -s /etc/systemd/system/envd.service /etc/systemd/system/multi-user.target.wants/envd.service

RUN mkdir -p /etc/systemd/system/serial-getty@ttyS0.service.d

RUN echo $' \n\
[Service] \n\
ExecStart= \n\
ExecStart=-/sbin/agetty --noissue --autologin root %I 115200,38400,9600 vt102 \n\
' >/etc/systemd/system/serial-getty@ttyS0.service.d/autologin.conf

RUN echo $' \n\
[Unit] \n\
Description=Env Daemon Service \n\
[Service] \n\
Type=simple \n\
Restart=always \n\
User=root \n\
Group=root \n\
ExecStart=/bin/bash -l -c /usr/bin/envd \n\
[Install] \n\
WantedBy=multi-user.target \n\
' >/etc/systemd/system/envd.service

WORKDIR /code
COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \ 
make build-debug

RUN mv /code/bin/debug/envd /usr/bin/envd

WORKDIR /

RUN systemctl enable envd
