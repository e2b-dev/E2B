{{ .BaseDockerfile }}

RUN curl -sL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get install -y nodejs

WORKDIR /code

RUN npm init -y

# Set env vars for devbook-daemon
RUN echo RUN_CMD=node >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=index.mjs >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=index.mjs >> /.dbkenv

WORKDIR /
