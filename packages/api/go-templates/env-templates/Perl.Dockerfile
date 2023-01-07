# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

RUN apk update && apk upgrade
RUN apk add --no-cache perl perl-app-cpanminus

WORKDIR code

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
