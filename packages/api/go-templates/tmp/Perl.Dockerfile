# All other templates are using the same base but Perl is annoying to set up so we are using premade image.
FROM scottw/alpine-perl

# This would be normally in the base
RUN apk add --no-cache util-linux openrc openssh
COPY devbookd /usr/bin/devbookd
COPY devbookd-init /etc/init.d/devbookd
COPY provision-env.sh provision-env.sh
RUN chmod +x provision-env.sh

WORKDIR code

RUN touch main.pl
RUN chmod +x main.pl

# Set env vars for devbook-daemon
RUN echo RUN_CMD=perl >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=./main.pl >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=main.pl >> /.dbkenv

RUN echo DEPS_CMD=cpanm >> /.dbkenv
RUN echo DEPS_INSTALL_ARGS= >> /.dbkenv

WORKDIR /
