{{ .BaseDockerfile }}

# Get Rust
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y

WORKDIR /code

# Set env vars for devbook-daemon
RUN echo RUN_CMD=cargo >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=src/main.rs >> /.dbkenv

WORKDIR /
