FROM golang:1.23

# Install Golang deps
RUN go install github.com/bufbuild/buf/cmd/buf@v1.50.1 && \
    go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28.1 && \
    go install connectrpc.com/connect/cmd/protoc-gen-connect-go@v1.18.1

# Install our custom protoc plugin, connect-python
COPY ./packages/connect-python /packages/connect-python
RUN cd /packages/connect-python && make bin/protoc-gen-connect-python


FROM python:3.9

# Set working directory
WORKDIR /workspace

ENV PROTOC_VERSION=29.3
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
        x86_64) PROTOC_ARCH="x86_64" ;; \
        arm64|aarch64) PROTOC_ARCH="aarch_64" ;; \
        *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    curl -LO https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-${PROTOC_ARCH}.zip && \
    unzip -o protoc-${PROTOC_VERSION}-linux-${PROTOC_ARCH}.zip -d /usr/local && \
    rm protoc-${PROTOC_VERSION}-linux-${PROTOC_ARCH}.zip

# Copy installed Go deps from previous build step
COPY --from=0 /go /go

# Add Go binary to PATH 
ENV PATH="/go/bin:${PATH}"

# Install Python deps
RUN pip install black==23.7.0 pyyaml==6.0.2 openapi-python-client==0.24.3

# Install Node.js and npm
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js deps
RUN npm install -g \
    pnpm \
    @connectrpc/protoc-gen-connect-es@1.6.1 \
    @bufbuild/protoc-gen-es@2.6.2 \
