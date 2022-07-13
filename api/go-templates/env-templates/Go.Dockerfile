# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

COPY --from=golang:1.18-alpine /usr/local/go/ /usr/local/go/

RUN cp /usr/local/go/bin/go /usr/bin/go

WORKDIR code
RUN go mod init main

{{ if .Deps }}
  RUN go get {{ range .Deps }}{{ . }} {{ end }}
{{ end }}

# Set env vars for devbook-daemon
RUN echo RUN_CMD=go >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run main.go >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=main.go >> /.dbkenv

WORKDIR /
