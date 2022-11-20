#!/usr/bin/env bash
# AutoTag application.
#
# MIT License
#
# Copyright (c) 2020 - 2022 MichaelCurrin
#
# https://github.com/MichaelCurrin/auto-tag/blob/master/LICENSE
set -e

FALLBACK_TAG='v0.0.0'
USAGE='USAGE:
    autotag LEVEL [-p] [-u] [-h]
'
HELP="HELP:
    Increment git tag using given increment level.

    Positional arguments:
        LEVEL         : 'M' for major, 'm' for minor or 'b' for bug.

    Flags:
        -h, --help    : Show help and exit.
        -p, --preview : Do a dry run to show the new tag label only, without
                        creating it. This must be used as the 2nd arg i.e. after
                        the LEVEL.
        -u, --upgrade : Download latest script from GitHub, write over current
                        script to install it, then exit. Uses cURL and not Git.
                        The normal tagging flow is ignored with this flag.
"
USER_ARGS="$*"
DOWNLOAD_URL='https://raw.githubusercontent.com/MichaelCurrin/auto-tag/master/autotag'

# Dynamic variables. Unfortunately all are global but at least there are
# functions now so the script is easier to work with. Also they don't have to be
# set here even, but are set for clarity.
LEVEL_CHOICE=''
PREVIEW=''
MAJOR=''
MINOR=''
BUG=''
LAST_TAG=''
NEW_TAG=''

# Print help if appropriate args were used.
help_if_needed() {
  if [[ "$#" -eq 0 ]] || [[ "$1" == '-h' ]] || [[ "$1" == '--help' ]]; then
    echo "$USAGE"
    echo "$HELP"
    exit 1
  fi
}

# Show error for invald args.
invalid_args_error() {
  echo "🛑 Invalid arguments: '$USER_ARGS'"
  echo
  echo "$USAGE"
  exit 1
}

# Prevent accidental use of autotag command in an NPM package.
check_if_npm() {
  if [[ -f 'package.json' ]]; then
    echo 'Error: Detected you are inside an NPM package.'
    echo '  Instead of `autotag`, please use `npm version minor` or similar'.
    exit 1
  fi
}

# Upgrade AutoTag.
download_update_if_needed() {
  if [[ "$#" -eq 0 ]] || [[ "$1" == '-u' ]] || [[ "$1" == '--upgrade' ]]; then
    SCRIPT_FILEPATH="$(realpath $0)"

    echo "ℹ️  Current path: $SCRIPT_FILEPATH"

    if ! command -v curl >/dev/null; then
      echo '🛑 `curl` is required for upgrading - please install it and try again'
      exit 1
    fi

    echo '⬇️  Downloading latest script'
    curl -q "$DOWNLOAD_URL" >"$SCRIPT_FILEPATH"

    echo '🚀 `autotag` script updated. Exiting...'
    sleep 1
    exit 0
  fi
}

# Process CLI arguments and set globals.
process_args() {
  LEVEL_CHOICE="$1"

  if [[ "$2" ]]; then
    if [[ "$2" == '-p' ]] || [[ "$2" == '--preview' ]]; then
      PREVIEW='true'
    else
      invalid_args_error
    fi
  else
    PREVIEW='false'
  fi
}

fetch_tags() {
  git fetch --tags
}

# Find the most recent tag in the current repo.
get_last_tag() {
  LAST_TAG=$(git describe --abbrev=0 --tags 2>/dev/null || true)
  LAST_TAG="${LAST_TAG:-$FALLBACK_TAG}"
  LAST_TAG="${LAST_TAG/v/}"

  # Replace dot with space then split into array.
  LAST_TAG_ARR=(${LAST_TAG//./ })

  MAJOR="${LAST_TAG_ARR[0]}"
  MINOR="${LAST_TAG_ARR[1]}"
  BUG="${LAST_TAG_ARR[2]}"
}

# Determine the new tag number.
set_level() {
  # Although the exit only happens after fetching, this needs to happen here so
  # variables are set.
  # Otherwise a refactor is needed to check M|m|b and exit if needed, then
  # actually calculate here.
  case "$LEVEL_CHOICE" in
  "M")
    ((MAJOR += 1))
    MINOR=0
    BUG=0
    ;;
  "m")
    ((MINOR += 1))
    BUG=0
    ;;
  "b")
    ((BUG += 1))
    ;;
  *)
    invalid_args_error
    ;;
  esac
}

# Create Git tag.
make_tag() {
  git tag -a "$NEW_TAG" \
    -m "$NEW_TAG"
}

run() {
  echo '🚛 Fetching tags...'
  fetch_tags

  echo '🔍 Finding most recent tag...'
  get_last_tag
  echo "👴 Last tag: v$MAJOR.$MINOR.$BUG"

  set_level
  NEW_TAG="v$MAJOR.$MINOR.$BUG"
  echo "⭐ New tag: $NEW_TAG"

  # For some reason these emojis need a double space after to avoid looking
  # squashed, at least on macOS.
  if [[ "$PREVIEW" == true ]]; then
    echo '⏭️  Skipping tag creation'
  else
    echo '🏷️  Creating annotated tag...'
    make_tag
  fi
}

# Command-line entry-point.
main() {
  help_if_needed $@

  check_if_npm
  download_update_if_needed $@
  process_args $@
  run
}

main $@
