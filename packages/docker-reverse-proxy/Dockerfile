FROM golang:1.22-alpine3.17 as builder

RUN apk add --no-cache make

WORKDIR /build/shared

COPY .shared/go.mod .shared/go.sum ./
RUN go mod download

COPY .shared/pkg pkg

WORKDIR /build/docker-reverse-proxy

COPY go.mod go.sum Makefile ./
RUN go mod download

COPY main.go main.go
COPY internal internal

RUN --mount=type=cache,target=/root/.cache/go-build make build

FROM alpine:3.17

COPY --from=builder /build/docker-reverse-proxy/bin/docker-reverse-proxy .

RUN chmod +x docker-reverse-proxy

ENTRYPOINT [ "./docker-reverse-proxy" ]
