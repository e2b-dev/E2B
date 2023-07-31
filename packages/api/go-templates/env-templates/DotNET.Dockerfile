{{ .BaseDockerfile }}

RUN apt-get install -y dotnet-sdk-7.0

WORKDIR /code

# RUN dotnet new console -lang VB

# Set env vars for devbook-daemon
RUN echo RUN_CMD=dotnet >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run>> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT="" >> /.dbkenv

WORKDIR /
