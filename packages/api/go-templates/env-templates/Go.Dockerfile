{{ .BaseDockerfile }}

RUN apt-get install -y golang-go

ENV PATH=/usr/local/go/bin:$PATH

RUN sed -i.bak '/^unset -f append_path/i append_path "/usr/local/go/bin"' /etc/profile
RUN sed -i.bak '/export PATH/a export GOLANG_VERSION=$GOLANG_VERSION' "/etc/profile"

WORKDIR /code

RUN go mod init main

# Set env vars for devbook-daemon
RUN echo RUN_CMD=go >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run main.go >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=main.go >> /.dbkenv

WORKDIR /
