version_file="VERSION"

old_version=`cat $version_file`
new_version=`./scripts/semver.sh -p $old_version`

echo -n $new_version > $version_file

increment_package_version() {
  package_path=$1
  version=$2

  npm version --prefix $package_path $version
  npm i --package-lock-only  --prefix $package_path
}

cli_path="packages/cli" 
sdk_path="packages/sdk" 

increment_package_version $cli_path $new_version
increment_package_version $sdk_path $new_version
