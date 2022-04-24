job "vm-session" {
  datacenters = ["dc1"]
  type = "batch"

  parameterized {}

  task "start-vm" {
    driver = "firecracker-task-driver"

    config {
      KernelImage = "/home/valenta.and.thomas/hello-vmlinux.bin"
      BootDisk    = "/home/valenta.and.thomas/hello-rootfs.ext4"
      BootOptions = "console=ttyS0 noapic reboot=k panic=1 pci=off nomodules rw"
      Firecracker = "/usr/local/bin/firecracker"
      Vcpus       = 1
      Mem         = 512
      Network     = "default"
    }
  }
}