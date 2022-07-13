# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

COPY --from=rust:alpine3.16 /usr/local/go/ /usr/local/go/

RUN cp /usr/local /usr/bin/go
RUN cp /usr/local/go/bin/go /usr/bin/go

RUN cargo new code --bin

WORKDIR code
# Empty the main.rs file.
RUN echo "" > src/main.rs

{{ if .Deps }}
  RUN cargo install {{ range .Deps }}{{ . }} {{ end }}
{{ end }}

# Set env vars for devbook-daemon
RUN echo RUN_CMD=cargo >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=src/main.rs >> /.dbkenv

WORKDIR /
