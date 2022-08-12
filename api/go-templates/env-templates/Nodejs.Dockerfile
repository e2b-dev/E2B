# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

RUN apk update && apk add --no-cache nodejs npm

WORKDIR /code
# Multiline string https://stackoverflow.com/questions/33439230/how-to-write-commands-with-multiple-lines-in-dockerfile-while-preserving-the-new
RUN echo $'{ \n\
  "name": "devbook", \n\
  "version": "1.0.0", \n\
  "main": "index.js", \n\
  "keywords": [], \n\
  "author": "", \n\
  "license": "ISC", \n\
  "type": "module" \n\
  }' > package.json
RUN npm init -y

{{ if .Deps }}
RUN npm i {{ range .Deps }}{{ . }} {{ end }}
{{ end }}

RUN npm config set strict-ssl false

# Set env vars for devbook-daemon
RUN echo RUN_CMD=node >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=index.js >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=index.js >> /.dbkenv

WORKDIR /
