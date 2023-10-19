FROM golang:1.21-alpine3.17 as builder

RUN apk add --no-cache make

WORKDIR /build

COPY go.mod go.sum Makefile ./
RUN go mod download

COPY internal internal
COPY main.go main.go

RUN --mount=type=cache,target=/root/.cache/go-build make build

FROM alpine:3.17

COPY --from=builder /build/bin/api .

RUN chmod +x api

# Set Gin server to the production mode
ENV GIN_MODE=release
ENTRYPOINT [ "./api"]
