{{ .BaseDockerfile }}

RUN apt-get install -y php php-curl

WORKDIR /code

# Set env vars for devbook-daemon
RUN echo RUN_CMD=php >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=index.php >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=index.php >> /.dbkenv

WORKDIR /
