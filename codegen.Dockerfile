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

ENV PROTOC_ZIP=protoc-29.3-linux-aarch_64.zip

RUN curl -OL https://github.com/protocolbuffers/protobuf/releases/download/v29.3/$PROTOC_ZIP
RUN unzip -o $PROTOC_ZIP -d /usr/local bin/protoc

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
RUN npm install -g pnpm @connectrpc/protoc-gen-connect-es@1.6.1 @bufbuild/protoc-gen-es@2.2.2

# Generate when container starts
CMD ["make", "generate"]
