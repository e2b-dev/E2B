Firecracker Task Driver
===========================

nomad task driver for creating [Firecracker](https://firecracker-microvm.github.io/) micro-vms.

- Website: https://www.nomadproject.io

Requirements
------------

- [Nomad](https://www.nomadproject.io/downloads.html) 0.9+
- [Go](https://golang.org/doc/install) 1.11 
- Linux 4.14+ Firecracker currently supports physical Linux x86_64 and aarch64 hosts, running kernel version 4.14 or later. However, the aarch64 support is not feature complete (alpha stage).
- KVM enabled in your Linux kernel, and you have read/write access to /dev/kvm.
- tun module loaded
- ip6tables package
- [Container networking plugins (Firecracker branch)](https://github.com/cneira/plugins)
- [tc-redirect-tap](https://github.com/awslabs/tc-redirect-tap)
- [Firecracker binary](https://github.com/firecracker-microvm/firecracker/releases/download/v0.16.0/firecracker-v0.16.0)


Installation
------------

Install(and compile) the firecracker-task-driver binary and put it in [plugin_dir](https://www.nomadproject.io/docs/configuration/index.html#plugin_dir) and then add a `plugin "firecracker-task-driver" {}` line in your nomad config file.


```shell
go get github.com/cneira/firecracker-task-driver
cp $GOPATH/bin/firecracker-task-driver YOURPLUGINDIR
```

Then in your nomad config file, set
```hcl
plugin "firecracker-task-driver" {}
```

In developer/test mode(`nomad agent -dev`) , plugin_dir is unset it seems, so you will need to mkdir plugins and then copy the firecracker-task-driver binary to plugins and add a `plugins_dir = "path/to/plugins"` to the above config file.
then you can run it like:

`nomad agent -dev -config nomad.config`

For more details see the nomad [docs](https://www.nomadproject.io/docs/configuration/plugin.html).
  

Container network configuration 
---------------------------------------
- Build [cni plugins (Firecracker branch)](https://github.com/cneira/plugins) and [tc-redirect-tap](https://github.com/awslabs/tc-redirect-tap) and copy them /opt/cni/bin
- Create a network configuration to be used by micro-vms on /etc/cni/conf.d/, for example: default.conflist.
   

```json
{
  "name": "default",
  "cniVersion": "0.4.0",
  "plugins": [
    {
      "type": "ptp",
      "ipMasq": true,
      "ipam": {
        "type": "host-local",
        "subnet": "192.168.127.0/24",
        "resolvConf": "/etc/resolv.conf"
      }
    },
    {
      "type": "firewall"
    },
    {
      "type": "tc-redirect-tap"
    }
  ]
}
```
Example : exposing port 27960 on micro-vm

```json
{
        "name": "microvms2",
                "cniVersion": "0.4.0",
                "plugins": [

                {
                        "type": "ptp",
                        "ipMasq": true,
                        "ipam": {
                                "type": "host-local",
                                "subnet": "192.168.127.0/24",
                                "resolvConf": "/etc/resolv.conf"
                        }
                },
                {
                        "type": "firewall"
                },
                {
                        "type": "portmap",
                        "capabilities": {"portMappings": true},
                        "runTimeConfig":  { 
                                "portMappings":
                                        [ { "hostPort": 27960, "containerPort": 27960, "protocol": "udp" }
                                        ] }
                },
                {
                        "type": "tc-redirect-tap"
                }

        ]
}
```

In this example with outside world connectivity for your vms. *The name of this network is default and this name is the parameter used in Network on the task driver job spec*.
Also the filename must match the name of the network, and the suffix .conflist.

Creating a rootfs and kernel image for firecracker
-------------------------------------------------
We need to an ext4 root filesystem to use as disk and an uncompressed vmlinux image, the process on how to generate them is described [here](https://github.com/firecracker-microvm/firecracker/blob/master/docs/rootfs-and-kernel-setup.md).

## Using [ZFS](https://github.com/openzfs/zfs) zvols to create a rootfs for microvms 

Leveraging zvols to expose rootfs to firecracker, is this is really simple, and zfs buys you a lot of benefits.
For example to create a Centos rootfs is as simple as:
First download a template image, for example from [OpenVZ](openvz.org)
http://download.openvz.org/template/precreated/centos-7-x86_64-minimal.tar.gz

### Now create a ZVOL to host this tarball
    
```sh
# zfs create -V 1G  zpool/centos7vm 
# mkfs.ext4  /dev/zvol/zpool/centos7vm
# mount -t ext4  /dev/zvol/zpool/centos7vm /mnt
# tar xfvz centos-7-x86_64-minimal.tar.gz -C /mnt
# zfs snapshot zpool/centos7vm@final 
```
Now you could tell the firecracker-task-driver to use that zvol as your BootDisk.
For example:
   
```hcl
job "example3" {
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
       Vcpus = 1 
       Mem = 128
       KernelImage= "/home/cneira/kernel-images/vmlinux.bin"
       BootDisk = "/dev/zvol/vms/centos7vm"
       Network = "default"
      }
    }
  }
}

```


## Firecracker task driver options 
-----------

### KernelImage (not required, default: vmlinux )

* kernel image to be used on the micro-vm, if this option is omitted it expects a vmlinux file in the allocation dir. 

### BootOptions (not required, default: "ro console=ttyS0 reboot=k panic=1 pci=off nomodules")   

* Kernel command line.

### BootDisk (not required, default: rootfs.ext4)

* ext4 rootfs to use, if this is omitted it expects a rootfs called rootfs.ext4 in the allocation dir.

### Disks (not required)

* Additional disks to add to the micro-vm, must use the suffix :ro or :rw, can be specified multiple times. 


### Network (not required) 

* Network name if using [CNI](https://github.com/containernetworking/cni)

### Vcpus (not required, default: 1) 

* Number of cpus to assign to micro-vm.

### Cputype (not required) 

*  The CPU Template defines a set of flags to be disabled from the microvm so that
   the features exposed to the guest are the same as in the selected instance type.
   templates available are C3 or T2.
  
### Mem (not required, default: 512) 

* Amount of memory in Megabytes to assign to micro-vm.


### Firecracker (not required, default: "/usr/bin/firecracker") 

* Location of the firecracker binary, the option could be omitted if the environment variable FIRECRACKER_BIN is set.

### Log (not required)

* Where to write logs from micro-vm. 

### DisableHt (not required, default: false)

* Disable CPU Hyperthreading.

When the microvm starts a file will be created in /tmp/ with the following name <task-name>-<allocation id>, 
for example :  /tmp/test01-785f9472-52a7-3dbf-8305-d482b1f7dc6f
will contain the following info :

```json
{
 "AllocId": "590983f4-499a-380f-420e-e5be4d5f46d9",
 "Ip": "192.168.127.62/24",
 "Serial": "/dev/pts/3",
 "Pid": "237216",
 "Vnic": "veth05fb4547vm"
}

```
- AllocId (given by nomad)
- Ip (Ip address assigned by cni configuration)
- Serial (tty where a serial console is setup for the vm)
- Pid ( Pid for the firecracker process that started the vm)
- Vnic (virtual interface on the host linked to the vm)
 
## Examples:

### Omitting KernelImage and BootDisk

Don't specifying *KernelImage* and *BootDisk* it will default to rootfs.ext4 and vmlinux in the allocation directory.

```hcl
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
```
  
### CNI network configuration
   -------------------------

```hcl
job "cni-network-configuration-example" {
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
       KernelImage = "/home/build/firecracker/hello-vmlinux.bin" 
       Firecracker = "/home/build/firecracker/firecracker" 
       Vcpus = 1 
       Mem = 128
       BootDisk = "/home/build/firecracker/hello-rootfs.ext4"
       Network = "fcnet"
      }
    }
  }
}
```
  
### Additional Disks configuration
   -------------------------------

```hcl
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
       Network = "default"
      }
    }
}
```
### Accessing the microvm using serial console

The firecracker-task-driver exposes the serial console as this option is handy to troubleshoot network
issues.
Each microvm generates a state file on the /tmp/ directory, named using the job name + allocation id.
For example:
    
```sh
-rw-r--r--. 1 root root  152 May 12 14:07 /tmp/test01-590983f4-499a-380f-420e-e5be4d5f46d9
```
The contents of the state file should be like the following:

```json
{
 "AllocId": "590983f4-499a-380f-420e-e5be4d5f46d9",
 "Ip": "192.168.127.62/24",
 "Serial": "/dev/pts/3",
 "Pid": "237216",
 "Vnic": "veth05fb4547vm"
}
```
Using the serial now we know which serial port is expose and it's a matter of connect to it.
You could use SCREEN(1) to connect to the serial console.

```sh
$ sudo screen /dev/pts/3

Started Update UTMP about System Runlevel Changes.

CentOS Linux 7 (Core)
Kernel 4.14.225 on an x86_64

192 login: 

```

##  Demo
[![asciicast](https://asciinema.org/a/279855.svg)](https://asciinema.org/a/279855)
  
## Support

[![ko-fi](https://www.ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/J3J4YM9U)  
      
It's also possible to support the project on [Patreon](https://www.patreon.com/neirac)  
    
## References

- [Container networking](https://github.com/containernetworking/cni/blob/spec-v0.3.1/SPEC.md)
- [Firecracker getting started](https://github.com/firecracker-microvm/firecracker/blob/master/docs/getting-started.md)
- [Rootfs and Kernel setup](https://github.com/firecracker-microvm/firecracker/blob/master/docs/rootfs-and-kernel-setup.md)

