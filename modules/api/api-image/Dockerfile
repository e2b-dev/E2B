FROM golang:1.18-alpine3.15 as builder

RUN apk add --no-cache make

WORKDIR /build

COPY go.mod go.sum Makefile ./
COPY cmd cmd
COPY internal internal
COPY pkg pkg

RUN make build

FROM alpine:3.15

COPY --from=builder /build/bin/api .

RUN chmod +x api

# Set Gin server to the production mode
# ENV GIN_MODE=release

CMD [ "./api", "--port", "80"]
