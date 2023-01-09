# IMPORTANT: Don't specify the FROM field here. The FROM field (with additional configuration) is injected during runtime.
# We will have a proper Devbook based image in the future.
{{ .BaseDockerfile }}

RUN apk update && apk upgrade

# Install .NET SDK
RUN apk add --no-cache \
  --repository http://dl-cdn.alpinelinux.org/alpine/edge/testing \
  --repository http://dl-cdn.alpinelinux.org/alpine/edge/main \
  --repository http://dl-cdn.alpinelinux.org/alpine/edge/community \
  libgdiplus dotnet7-sdk bash icu-libs krb5-libs libgcc libintl libssl1.1 libstdc++ zlib

# Install Powershell
RUN powershell_version=7.3.0 \
    && wget -O PowerShell.Linux.Alpine.$powershell_version.nupkg https://pwshtool.blob.core.windows.net/tool/$powershell_version/PowerShell.Linux.Alpine.$powershell_version.nupkg \
    && powershell_sha512='d22736ec497d1b55d641ffaa862eef7d23eb2f0c336be407a87706aa73989145c75c6a0d49ad8fe6336c6096083c78d201e810b4e0d67f22331bb95c3b1a4a1d' \
    && echo "$powershell_sha512  PowerShell.Linux.Alpine.$powershell_version.nupkg" | sha512sum -c - \
    && mkdir -p /usr/share/powershell \
    && dotnet tool install --add-source / --tool-path /usr/share/powershell --version $powershell_version PowerShell.Linux.Alpine \
    && dotnet nuget locals all --clear \
    && rm PowerShell.Linux.Alpine.$powershell_version.nupkg \
    && ln -s /usr/share/powershell/pwsh /usr/bin/pwsh \
    && chmod 755 /usr/share/powershell/pwsh \
    # To reduce image size, remove the copy nupkg that nuget keeps.
    && find /usr/share/powershell -print | grep -i '.*[.]nupkg$' | xargs rm \
    # Add ncurses-terminfo-base to resolve psreadline dependency
    && apk add --no-cache ncurses-terminfo-base

WORKDIR code

# RUN dotnet new console -lang VB

# Set env vars for devbook-daemon
RUN echo RUN_CMD=dotnet >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run>> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT="" >> /.dbkenv

WORKDIR /
