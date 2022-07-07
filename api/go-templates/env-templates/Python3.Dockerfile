# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

ENV PIP_DEFAULT_TIMEOUT=100 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.0.5

RUN apk update && apk add --no-cache python3 py3-pip
# Install poetry
RUN pip3 install "poetry==$POETRY_VERSION"

RUN poetry new code

WORKDIR code
RUN rm -rf tests README.rst
RUN touch main.py

# Poetry creates a virtual env on the first run.
RUN poetry run python main.py

{{ if .Deps }}
  RUN poetry add {{ range .Deps }}{{ . }} {{ end }}

  # {
  #   "dep1": true
  #   ,"dep2": true
  # }
  RUN echo { >> /.dbkdeps.json
  {{ range .Deps }}
    RUN echo ',"{{ . }}": true' >> /.dbkdeps.json
  {{ end }}
  RUN echo } >> /.dbkdeps.json
{{ end }}

# Set env vars for devbook-daemon
RUN echo RUN_CMD=poetry >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run python main.py >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=main.py >> /.dbkenv

WORKDIR /
