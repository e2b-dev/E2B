#! /bin/bash
# This script will kill any running devbookd process and uninstall it from macOS' launchd

set -eu
set -o pipefail

os=$(uname -s)
if [ $os != "Darwin" ]; then
  echo "❌ Only macOS is supported"
fi

# Find out which user is running the installation.
inst_user=`stat /dev/console | cut -f 5 -d ' '`
service_id="com.devbook.devbookd"
service_file="$HOME/Library/LaunchAgents/${service_id}.plist"

# Cleanup the service from a potential previous installation.
set +e
echo "> 🚧 Unloading '$service_file' from launchd..."
launchctl unload $service_file > /dev/null 2>&1
echo "- ✅ Done"
echo

echo "> 🚧 Killing possible 'devbookd' process..."
killall devbookd > /dev/null 2>&1
echo "- ✅ Done"
echo

if [ -f $service_file ]; then
  echo "> 🚧 Removing '$service_file'..."
  rm $service_file
  echo "- ✅ Done"
  echo
fi

set -e

echo "✅ Uninstalled"