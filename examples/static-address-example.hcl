job "test1" {
  datacenters = ["dc1"]
  type        = "service"

  group "test" {
    restart {
      attempts = 0
      mode     = "fail"
    }
    task "test01" {
      driver = "firecracker-task-driver"
      config {
       KernelImage = "/home/build/hello-vmlinux.bin" 
       Firecracker = "/home/build/firecracker" 
       Vcpus = 1 
       Mem = 128
       BootDisk = "/home/build/rootfs.ext4"
       Nic =  {
	Ip="172.17.0.1/16"	
	Gateway = "192.168.1.1"
	Nameservers = [ "8.8.8.8", "8.8.8.4"]
	Interface = "tap0"
       }
      }
    }
  }
}
