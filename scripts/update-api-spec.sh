#!/bin/sh

set -eu

# This script is used to update the spec/openapi.yml file from the api repo

# Check if the remote is set
if [ -z "$(git remote get-url api)" ]; then
  git remote add api git@github.com:e2b-dev/infra.git
fi

# Get the current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Fetch the latest changes
git fetch api

# Checkout the latest changes
git checkout api/main -B temp_api_branch

# Create a temporary branch to store the spec
git subtree split --prefix=spec -b temp_spec_branch

# Checkout the branch
git checkout "$BRANCH"

# Merge the changes
git subtree merge --prefix=spec temp_spec_branch --squash

# Remove the temporary branch
git branch -D temp_spec_branch
git branch -D temp_api_branch
