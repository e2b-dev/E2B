# This Dockerfile is for creating a testing environment for devbookd.
# docker build -t devbookd-testenv . -f testenv.Dockerfile
# docker run -p 127.0.0.1:8010:8010 -it devbookd-testenv /bin/bash

FROM ubuntu

COPY bin/devbookd /usr/bin/devbookd

WORKDIR code

# Set env vars for devbook-daemon
RUN echo RUN_CMD=node >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=index.js >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=index.js >> /.dbkenv

# Deps installation
RUN echo DEPS_CMD=npm >> /.dbkenv
RUN echo DEPS_INSTALL_ARGS=install >> /.dbkenv
RUN echo DEPS_UNINSTALL_ARGS=uninstall >> /.dbkenv

WORKDIR /
