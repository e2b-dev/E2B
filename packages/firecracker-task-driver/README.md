# Firecracker Task Driver

## Development
For generating the FC client use go swagger (https://goswagger.io/install.html).
Right now you need to manually check and update the [firecracker yml](./internal/client/firecracker.yml) version. It should match the version of the firecracker binary you are using specified in the [terraform file](../cluster-disk-image/variables.pkr.hcl).
