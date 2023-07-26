version_file="VERSION"

old_version=`cat $version_file`
new_version=`./scripts/semver.sh -p $old_version`

printf "$new_version" > "$version_file"

increment_package_version() {
  package_path=$1
  version=$2

  npm version --prefix $package_path $version
}

cli_path="packages/cli" 
sdk_path="packages/sdk"

increment_package_version $sdk_path $new_version
npm i --package-lock-only --prefix $sdk_path

increment_package_version $cli_path $new_version
# We run npm i only for the sdk because pnpm does not have CLI package version in the lockfile
