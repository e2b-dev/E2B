# Using premade Rust image that's based on Alpine Linux produces much smaller image.
FROM rust:alpine3.16

# 2

RUN apk update && apk upgrade
RUN apk add --no-cache util-linux openrc openssh

COPY devbookd /usr/bin/devbookd
COPY devbookd-init /etc/init.d/devbookd
COPY provision-env.sh provision-env.sh
RUN chmod +x provision-env.sh

#RUN /root/.cargo/bin/cargo new code --bin
#
#WORKDIR code
## Empty the main.rs file.
#RUN echo "" > src/main.rs
#
#
#{{ if .Deps }}
#  {{ range .Deps }}
#    RUN echo "{{ . }}" >> Cargo.toml
#  {{ end }}
#
#  # {
#  #   "dep1": true
#  #   ,"dep2": true
#  # }
#  RUN echo { >> /.dbkdeps.json
#  {{ range .Deps }}
#    RUN echo ',"{{ . }}": true' >> /.dbkdeps.json
#  {{ end }}
#  RUN echo } >> /.dbkdeps.json
#{{ end }}
#
#
## Set env vars for devbook-daemon
#RUN echo RUN_CMD=//root/.cargo/bin/cargo >> /.dbkenv
## Format: RUN_ARGS=arg1 arg2 arg3
#RUN echo RUN_ARGS=run >> /.dbkenv
#RUN echo WORKDIR=/code >> /.dbkenv
## Relative to the WORKDIR env.
#RUN echo ENTRYPOINT=src/main.rs >> /.dbkenv
#
## TODO: Deps (un)installation
##RUN echo DEPS_CMD=/root/.poetry/bin/poetry >> /.dbkenv
##RUN echo DEPS_INSTALL_ARGS=add >> /.dbkenv
##RUN echo DEPS_UNINSTALL_ARGS=remove >> /.dbkenv
#
#WORKDIR /
#
