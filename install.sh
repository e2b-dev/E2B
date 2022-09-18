#!/bin/sh
# User installs cripts
# Based on flyctl install.sh and https://github.com/curquiza/MeiliSearch/blob/e291d9954a18413c99105def1a2d32e63e5715be/download-latest.sh
# Based on Deno installer: Copyright 2019 the Deno authors. All rights reserved. MIT license.
# TODO(everyone): Keep this script simple and easily auditable.

set -e

os=$(uname -s)
arch=$(uname -m)
#version=${1:-latest}
devbookd_uri="https://github.com/devbookhq/devbookd/releases/latest/download/devbookd_${os}_${arch}.tar.gz"
echo $devbookd_uri
exit 1

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

echo "Devbook daemon was installed successfully to $exe"
echo "Starting Devbook daemon..."
sh -c "$exe"
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
