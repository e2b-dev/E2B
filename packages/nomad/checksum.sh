#!/bin/bash
# This script is used to convert a base64 encoded string to hex

set -euo pipefail


# Extract "base64" arguments from the input into shell variables.
eval "$(jq -r '@sh "BASE64=\(.base64)"')"

result=$(echo "${BASE64}" | base64 -d | xxd -p)

# Safely produce a JSON object containing the result value.
# jq will ensure that the value is properly quoted
# and escaped to produce a valid JSON string.
jq -n --arg result "$result" '{"hex":$result}'
