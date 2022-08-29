# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

RUN apk update && apk add --no-cache nodejs npm
RUN npm config set strict-ssl false

WORKDIR /code
RUN npm i -D typescript ts-node
RUN npx tsc --init
RUN touch index.ts

{{ if .Deps }}
RUN npm i {{ range .Deps }}{{ . }} {{ end }}
{{ end }}


# Set env vars for devbook-daemon
RUN echo RUN_CMD=ts-node >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=index.ts >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=index.ts >> /.dbkenv

WORKDIR /
