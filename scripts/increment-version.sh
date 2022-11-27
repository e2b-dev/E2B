version_file="VERSION"

old_version=`cat $version_file`
new_version=`./scripts/semver.sh -p $old_version`

echo -n $new_version > $version_file

npm version --prefix packages/sdk $new_version
