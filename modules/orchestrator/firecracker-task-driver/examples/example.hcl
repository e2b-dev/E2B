job "example" {
  datacenters = ["dc1"]
  type        = "service"

  group "test" {
    restart {
      attempts = 0
      mode     = "fail"
    }
    task "test01" {

   artifact {
	source = "https://firecracker-kernels.s3-sa-east-1.amazonaws.com/vmlinux-5.4.0-rc5.tar.gz"
	destination = "."
  }
   artifact {
	source = "https://firecracker-rootfs.s3-sa-east-1.amazonaws.com/ubuntu16.04.rootfs.tar.gz"
	destination = "."
  }
      driver = "firecracker-task-driver"
      config {
       Vcpus = 1 
       Mem = 128
       Network = "default"
      }
    }
  }
}
