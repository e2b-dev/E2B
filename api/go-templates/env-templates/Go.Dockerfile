# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

COPY --from=golang:1.18-alpine /usr/local/go/ /usr/local/go/
ENV PATH="/usr/local/go/bin:${PATH}"
#RUN echo "export PATH=/usr/local/go/bin:${PATH}" >> /etc/profile
RUN echo "export PATH=/usr/local/go/bin:${PATH}" >> /etc/environment

WORKDIR code
RUN go mod init main
RUN go get {{ range .Deps }}{{ . }} {{ end }}

# Set env vars for devbook-daemon
RUN echo RUN_CMD=go >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=main.go >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=main.go >> /.dbkenv

# Deps installation
RUN echo DEPS_CMD=go >> /.dbkenv
RUN echo DEPS_INSTALL_ARGS=get >> /.dbkenv
# TODO: https://stackoverflow.com/questions/13792254/removing-packages-installed-with-go-get
RUN echo DEPS_UNINSTALL_ARGS=uninstall >> /.dbkenv

WORKDIR /
