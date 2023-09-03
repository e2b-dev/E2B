FROM golang:1.19-alpine3.15 as builder

RUN apk add --no-cache make

WORKDIR /build

COPY go.mod go.sum Makefile ./
RUN go mod download

COPY internal internal
COPY main.go main.go

RUN make build

FROM alpine:3.15

COPY --from=builder /build/bin/api .
COPY go-templates go-templates

RUN chmod +x api

# Set Gin server to the production mode
ENV GIN_MODE=release
ENTRYPOINT [ "./api"]
