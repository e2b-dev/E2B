# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

RUN apk update && apk add bash curl

WORKDIR code

{{ if .Deps }}
  RUN apk add {{ range .Deps }}{{ . }} {{ end }}

  RUN echo { >> /.dbkdeps.json
  {{ range $idx, $el := .Deps }}
    RUN echo '{{if $idx}},{{end}}"{{ $el }}": true' >> /.dbkdeps.json
  {{ end }}
  RUN echo } >> /.dbkdeps.json
{{ end }}

# Set env vars for devbook-daemon
RUN echo RUN_CMD=bash >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=index.sh >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=index.sh >> /.dbkenv

WORKDIR /
