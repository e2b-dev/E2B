{{ .BaseDockerfile }}

RUN apt-get install -y openjdk-17-jdk

WORKDIR /code

# Set env vars for devbook-daemon
RUN echo RUN_CMD=java >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=Main.java >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=Main.java >> /.dbkenv

WORKDIR /
