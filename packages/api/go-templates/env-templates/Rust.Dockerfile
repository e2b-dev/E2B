# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

RUN apk update && apk upgrade 
RUN apk add --no-cache gcc

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH \
    RUST_VERSION=1.66.0

RUN set -eux; \
    wget "https://static.rust-lang.org/rustup/dist/x86_64-unknown-linux-musl/rustup-init"; \
    chmod +x rustup-init; \
    ./rustup-init -y --no-modify-path --profile minimal --default-toolchain $RUST_VERSION --default-host x86_64-unknown-linux-musl; \
    rm rustup-init; \
    chmod -R a+w $RUSTUP_HOME $CARGO_HOME; \
    rustup --version; \
    cargo --version; \
    rustc --version;

RUN sed -i.bak '/^unset -f append_path/i append_path "/usr/local/cargo/bin"' /etc/profile
RUN sed -i.bak '/export PATH/a export CARGO_HOME=/usr/local/cargo' '/etc/profile'
RUN sed -i.bak '/export PATH/a export RUSTUP_HOME=/usr/local/rustup' '/etc/profile'
RUN sed -i.bak '/export PATH/a export RUST_VERSION=1.66.0' '/etc/profile'

RUN cargo new code --bin

WORKDIR code

RUN echo "" > src/main.rs

RUN cargo fetch

# Set env vars for devbook-daemon
RUN echo RUN_CMD=cargo >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=src/main.rs >> /.dbkenv

WORKDIR /
