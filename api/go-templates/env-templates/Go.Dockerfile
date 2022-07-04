# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

# 5

#RUN apk add --no-cache go=1.18.2-r0
COPY --from=golang:1.18-alpine /usr/local/go/ /usr/local/go/
ENV PATH="/usr/local/go/bin:${PATH}"

# TODO: Adding anything to PATH in Alpine Linux is a major PITA and I couldn't figure out how to do it.
# Insert 'append_path "/usr/local/go/bin"' above the line 'unset -f append_path'
#RUN sed '/^unset -f append_path/i append_path "/usr/local/go/bin"' /etc/profile > /etc/profile.new
#RUN mv /etc/profile.new /etc/profile
#RUN echo "export PATH=/usr/local/go/bin:${PATH}" >> /etc/profile
#RUN echo "export PATH=/usr/local/go/bin:${PATH}" >> /etc/environment

WORKDIR code
RUN go mod init main

{{ if .Deps }}
  RUN go get {{ range .Deps }}{{ . }} {{ end }}

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
RUN echo RUN_CMD=/usr/local/go/bin/go >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run main.go >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=main.go >> /.dbkenv

# Deps installation
RUN echo DEPS_CMD=go >> /.dbkenv
RUN echo DEPS_INSTALL_ARGS=get >> /.dbkenv
# TODO: https://stackoverflow.com/questions/13792254/removing-packages-installed-with-go-get
RUN echo DEPS_UNINSTALL_ARGS=uninstall >> /.dbkenv

WORKDIR /
