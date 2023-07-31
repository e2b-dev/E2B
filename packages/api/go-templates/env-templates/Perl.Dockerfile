{{ .BaseDockerfile }}

RUN apt-get install -y perl

WORKDIR /code

RUN touch main.pl
RUN chmod +x main.pl

# Set env vars for devbook-daemon
RUN echo RUN_CMD=perl >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=main.pl >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=main.pl >> /.dbkenv

WORKDIR /
