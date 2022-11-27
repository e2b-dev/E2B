# Devbook API
Monorepo with backend services for handling VM sessions, environment pipelines, and the API for them.

## Development

### Architecture
[FigmaJam overview](https://www.figma.com/file/pr02o1okRpScOmNpAmgvCL/Architecture)

## Deployment
Run `make increment-version` and commit the changes the command generates. 
Then push to `master` to deploy these changes. Changed packages will be automatically deployed.

**If the deployment fails don't run the previous commands again, just fix the error and push to `master`.**
