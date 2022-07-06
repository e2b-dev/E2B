# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

RUN apk add --no-cache python3 curl
# Install poetry
RUN curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python3 -

RUN /root/.poetry/bin/poetry new code

WORKDIR code
RUN rm -rf tests README.rst
RUN touch main.py

# Poetry creates a virtual env on the first run.
RUN /root/.poetry/bin/poetry run python main.py

{{ if .Deps }}
  RUN /root/.poetry/bin/poetry add {{ range .Deps }}{{ . }} {{ end }}

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
RUN echo RUN_CMD=/root/.poetry/bin/poetry >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run python main.py >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=main.py >> /.dbkenv

WORKDIR /
