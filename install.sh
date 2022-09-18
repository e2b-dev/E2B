#!/bin/sh
# User install script. DON'T USE THIS TO INSTALL DEVBOOKD ON YOUR SERVER.
# Based on flyctl install.sh and https://github.com/curquiza/MeiliSearch/blob/e291d9954a18413c99105def1a2d32e63e5715be/download-latest.sh
# Based on Deno installer: Copyright 2019 the Deno authors. All rights reserved. MIT license.
# TODO(everyone): Keep this script simple and easily auditable.

set -eu
set -o pipefail

os=$(uname -s)
arch=$(uname -m)

# TODO: Only macOS is supported for now
if [ $os != "Darwin" ]; then
  echo "❌ Devbook daemon can only be installed on macOS for now"
  exit 1
fi

#version=${1:-latest}
devbookd_uri="https://github.com/devbookhq/devbookd/releases/latest/download/devbookd_${os}_${arch}.tar.gz"

if [ ! "$devbookd_uri" ]; then
	echo "Error: Unable to find a devbookd release for $os/$arch - see github.com/devbookhq/devbookd/releases for all releases and version" 1>&2
	exit 1
fi

devbookd_install="${DEVBOOKD_INSTALL:-$HOME/.devbook}"

bin_dir="$devbookd_install/bin"
exe="$bin_dir/devbookd"

if [ ! -d "$bin_dir" ]; then
 	mkdir -p "$bin_dir"
fi

curl --fail --location --progress-bar --output "$exe.tar.gz" "$devbookd_uri"
cd "$bin_dir"
tar xzf "$exe.tar.gz"
chmod +x "$exe"
rm "$exe.tar.gz"

# TODO: We don't support `devbookd version` yet.
#if [ "${2}" = "prerel" ] || [ "${1}" = "pre" ]; then
#	"$exe" version -s "shell-prerel"
#else
#	"$exe" version -s "shell"
#fi

echo "✅ Devbook daemon was installed successfully to $exe"
echo "🚧 Starting Devbook daemon..."

# Find out which user is running the installation.
inst_user=`stat /dev/console | cut -f 5 -d ' '`
service_id="com.devbook.devbookd"
service_file="$HOME/Library/LaunchAgents/${service_id}.plist"

# Cleanup the service from a potential previous installation.
set +e
launchctl unload $service_file > /dev/null 2>&1
killall devbookd > /dev/null 2>&1
if [ -f $service_file ]; then
  rm $service_file
fi
set -e

cat << EOF > $service_file
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$service_id</string>

  <key>UserName</key>
  <string>$inst_user</string>

  <key>KeepAlive</key>
  <true/>

  <key>RunAtLoad</key>
  <true/>

  <key>Listeners</key>
  <dict>
    <key>SockServiceName</key>
    <string>8010</string>
    <key>SockType</key>
    <string>stream</string>
    <key>SockFamily</key>
    <string>IPv4</string>
  </dict>

  <key>StandardErrorPath</key>
  <string>/tmp/${service_id}.job.err</string>
  <key>StandardOutPath</key>
  <string>/tmp/${service_id}.job.out</string>

  <key>ProgramArguments</key>
  <array>
    <string>sh</string>
    <string>-c</string>
    <string>$exe -mode=user</string>
  </array>
</dict>
</plist>
EOF

# Start the service
launchctl load $service_file
echo "✅ Devbook daemon is running"

# No need to add devbookd to the user's path env var. Devbook daemon isn't a CLI.
#if command -v devbookd >/dev/null; then
#	echo "Run 'dev --help' to get started"
#else
#	case $SHELL in
#	/bin/zsh) shell_profile=".zshrc" ;;
#  /bin/fish) shell_profile=".config/fish/config.fish" ;;
#	*) shell_profile=".bash_profile" ;;
#	esac
#	echo "Manually add the directory to your \$HOME/$shell_profile (or similar)"
#	echo "  export DEVBOOKD_INSTALL=\"$devbookd_install\""
#	echo "  export PATH=\"\$DEVBOOKD_INSTALL/bin:\$PATH\""
#fi
