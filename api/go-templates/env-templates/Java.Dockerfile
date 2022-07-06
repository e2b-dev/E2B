# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

RUN apk add --no-cache openjdk11

WORKDIR code

# TODO
#{{ if .Deps }}
#  RUN go get {{ range .Deps }}{{ . }} {{ end }}
#
# {
#  #   "dep1": true
#  #   ,"dep2": true
#  # }
#  RUN echo { >> /.dbkdeps.json
#  {{ range .Deps }}
#    RUN echo ',"{{ . }}": true' >> /.dbkdeps.json
#  {{ end }}
#  RUN echo } >> /.dbkdeps.json
#{{ end }}

# Set env vars for devbook-daemon
RUN echo RUN_CMD=java >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=Main.java >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=Main.java >> /.dbkenv

# TODO: Deps installation
#RUN echo DEPS_CMD=todo >> /.dbkenv
#RUN echo DEPS_INSTALL_ARGS=todo >> /.dbkenv
## TODO: https://stackoverflow.com/questions/13792254/removing-packages-installed-with-go-get
#RUN echo DEPS_UNINSTALL_ARGS=todo >> /.dbkenv

WORKDIR /
