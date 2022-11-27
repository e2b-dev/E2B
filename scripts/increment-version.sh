version_file="VERSION"

old_version=`cat $version_file`
new_version=`./scripts/semver.sh -p $old_version`

echo -n $new_version > $version_file


sdk_path="packages/sdk" 

npm version --prefix $sdk_path $new_version
npm i --package-lock-only --prefix $sdk_path