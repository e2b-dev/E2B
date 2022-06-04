## build-env.sh
Used in Nomad job to build the Firecracker rootfs and then create a snapshot of this environment.

## provision-env.sh
A script that's executed once inside a running Docker container. The Docker container is then converted to a rootfs for Firecracker.

## devbookd
A Devbook agent that runs inside a Firecracker VM for its whole lifecycle. It provides the ability to run code inside the VM.

## publish.sh
Used for uploading the devbookd binary, build-env.sh, publish-env.sh and provision-env.sh to the Google Cloud Storage. The files are then downloaded as artifacts during the Nomad job for building the Firecracker environment.
