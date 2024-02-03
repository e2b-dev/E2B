#!/usr/bin/env bash

npm pkg set 'name'='@e2b/sdk'
npm publish --no-git-checks
npm pkg set 'name'='e2b'
npm deprecate "@e2b/sdk@$(npm pkg get version | tr -d \")" "The package @e2b/sdk has been renamed to e2b. Please uninstall the old one and install the new by running following command: npm uninstall @e2b/sdk && npm install e2b"
