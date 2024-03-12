FROM golang:1.21-alpine3.17 as builder

RUN apk add --no-cache make



WORKDIR /docker-reverse-proxy

COPY go.mod go.sum Makefile ./
RUN go mod download

#COPY internal internal
COPY main.go main.go

RUN --mount=type=cache,target=/root/.cache/go-build make build

FROM alpine:3.17

COPY --from=builder /docker-reverse-proxy/bin/docker-reverse-proxy .

RUN chmod +x docker-reverse-proxy

# Set Gin server to the production mode
ENV GIN_MODE=release
ENTRYPOINT [ "./docker-reverse-proxy" ]
