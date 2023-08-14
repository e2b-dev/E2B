version_file="VERSION"

old_version=$(cat $version_file)
new_version=$(./scripts/semver.sh -p $old_version)

printf "$new_version" >"$version_file"
