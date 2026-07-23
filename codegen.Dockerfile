FROM golang:1.23

# Install Golang deps
RUN go install github.com/bufbuild/buf/cmd/buf@v1.50.1 && \
    go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.28.1 && \
    go install connectrpc.com/connect/cmd/protoc-gen-connect-go@v1.18.1


FROM python:3.10

# Set working directory
WORKDIR /workspace

# Copy installed Go deps from previous build step
COPY --from=0 /go /go

# Add Go binary to PATH
ENV PATH="/go/bin:${PATH}"

# Install Python deps (e2b-openapi-python-client is patched version to fix issue with explode)
# https://github.com/openapi-generators/openapi-python-client/pull/1296
# protoc-gen-py generates the Python envd protobuf-py messages and
# protoc-gen-connectrpc the Connect stubs.
RUN pip install black==26.3.1 pyyaml==6.0.2 e2b-openapi-python-client==0.26.2 datamodel-code-generator==0.34.0 protoc-gen-connectrpc==0.11.1 protoc-gen-py==0.1.1

# Install Node.js (pinned to match .tool-versions)
ENV NODE_VERSION=22.18.0
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
        x86_64) NODE_ARCH="x64" ;; \
        arm64|aarch64) NODE_ARCH="arm64" ;; \
        *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz | tar -xJ -C /usr/local --strip-components=1

# Install Node.js deps
ENV PNPM_VERSION=9.15.5
RUN npm install -g \
    pnpm@${PNPM_VERSION} \
    @connectrpc/protoc-gen-connect-es@1.6.1 \
    @bufbuild/protoc-gen-es@2.6.2

CMD ["make", "generate"]
