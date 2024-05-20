FROM golang:1.22-alpine3.17 as builder

RUN apk add --no-cache make

WORKDIR /build/shared

COPY packages/shared/go.mod packages/shared/go.sum ./
RUN go mod download

COPY packages/shared/pkg pkg

WORKDIR /build/api

COPY packages/api/go.mod packages/api/go.sum packages/api/Makefile ./
RUN go mod download

COPY packages/api/internal internal
COPY packages/api/main.go main.go

RUN --mount=type=cache,target=/root/.cache/go-build make build

FROM alpine:3.17

COPY --from=builder /build/api/bin/api .

RUN chmod +x api

# Set Gin server to the production mode
ENV GIN_MODE=release
ENTRYPOINT [ "./api"]
