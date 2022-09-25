#! /bin/bash

set -eu
set -o pipefail

os=$(uname -s | tr '[:upper:]' '[:lower:]')

echo "🚧 Making development build for '$os'..."
make build-${os}
echo "✅ Built"

echo

echo "🚧 Will install the development build"
echo "❗️ The already installed devbookd will be replaced by this build"

devbookd_install="${DEVBOOKD_INSTALL:-$HOME/.devbook}"
bin_dir="$devbookd_install/bin"
exe="$bin_dir/devbookd"
if [ ! -d "$bin_dir" ]; then
 	mkdir -p "$bin_dir"
fi

# Move the dev build to the bin_dir
mv ./bin/darwin/devbookd $exe

cd "$bin_dir"
chmod +x "$exe"

echo "✅ Devbook daemon was installed successfully to $exe"

echo
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