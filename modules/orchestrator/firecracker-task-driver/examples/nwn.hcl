job "neverwinter" {
  datacenters = ["dc1"]
  type        = "service"
   task "nwn-server" {
      driver = "firecracker-task-driver"
      config {
       Vcpus = 1 
       KernelImage = "/home/cneira/Development/vmlinuxs/vmlinux"
       BootDisk= "/home/cneira/Development/rootfs/ubuntu/18.04/nwnrootfs.ext4"
       Disks = [ "/home/cneira/Development/disks/disk0.ext4:rw" ]
       Mem = 1000 
       Network = "microvms"
      }
    }
}
