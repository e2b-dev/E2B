package env

import (
	"context"

	"go.opentelemetry.io/otel/trace"
)

type Rootfs struct {
	
}

func NewRootfs(ctx context.Context, tracer trace.Tracer, env *StorageEnv) (*Rootfs, error) {

  rootfs := &Rootfs{

  }



	//

return rootfs, nil

}



func (r *Rootfs) createEmptyDiskImage() error {

  //

}

func (r *Rootfs) buildDockerImage() error {

  //

}

func (r *Rootfs) runProvisionScript() error {

  //

}

func (r *Rootfs) runProvisionScript() error {

  //

}






func (r *Rootfs) getTag() string {
	return r.env.
	//

}


// function mkrootfs() {
//   echo "===> Making rootfs..."

//   local tag=rootfs-${RUN_UUID}

//   local free=3000000000 # 3000MB in B

//   if [ "$CODE_SNIPPET_ID" == "Rust" ]; then
//     free=3300000000 # 3300MB in B
//   fi

//   cp $ENVD $SCRIPTDIR/envd

//   echo -e "$DOCKERFILE" | docker build -t $tag -f - $SCRIPTDIR
//   local container_id=$(docker run -dt $tag /bin/sh)
//   docker exec -u root $container_id /provision-env.sh
//   local container_size=$(docker image inspect $tag:latest --format='{{.Size}}')
//   local rootfs_size=$(($container_size + $free))

//   echo "===> Rootfs size: ${rootfs_size}B"

//   qemu-img create -f raw $BUILD_FC_ROOTFS ${rootfs_size}B
//   mkfs.ext4 $BUILD_FC_ROOTFS
//   mount $BUILD_FC_ROOTFS $BUILD_MNT_DIR
//   docker cp $container_id:/ $BUILD_MNT_DIR

//   # -- Cleanup --
//   umount $BUILD_MNT_DIR
//   rm -rf $BUILD_MNT_DIR

//   docker kill $container_id &&
//     docker rm -f $container_id &&
//     docker rmi -f $tag

//   echo "===> rootfs done"
// }
