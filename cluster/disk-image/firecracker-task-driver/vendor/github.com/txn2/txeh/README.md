![txeh - /etc/hosts mangement](logo.png)


# Etc Hosts Management Utility & Go Library

[![Go Report Card](https://goreportcard.com/badge/github.com/txn2/txeh)](https://goreportcard.com/report/github.com/txn2/txeh)
[![GoDoc](https://godoc.org/github.com/txn2/irsync/txeh?status.svg)](https://godoc.org/github.com/txn2/txeh)

### /etc/hosts Management

It is easy to open your [/etc/hosts] file in text editor and add or remove entries. However, if you make heavy use of [/etc/hosts] for software development or DevOps purposes, it can sometimes be difficult to automate and validate large numbers of host entries.

**txeh** was initially built as a golang library to support [kubefwd](https://github.com/txn2/kubefwd), a Kubernetes port-forwarding utility utilizing [/etc/hosts] heavily, to associate custom hostnames with multiple local loopback IP addresses and remove these entries when it terminates.

A computer's [/etc/hosts] file is a powerful utility for developers and system administrators to create localized, custom DNS entries. This small go library and utility were developed to encapsulate the complexity of working with [/etc/hosts] directly by providing a simple interface for adding and removing entries in a [/etc/hosts] file.

## txeh Utility

### Install

MacOS [homebrew](https://brew.sh) users can `brew install txn2/tap/txeh`, otherwise see [releases](https://github.com/txn2/txeh/releases) for packages and binaries for a number of distros and architectures including Windows, Linux and Arm based systems.

Complie and run from source (dependencies are vendored):
```
go run ./util/txeh.go
```

### Use

The txeh CLI application allows command line or scripted access to /etc/hosts file modification.

**Example CLI Usage**:
```bash
 _            _
| |___  _____| |__
| __\ \/ / _ \ '_ \
| |_ >  <  __/ | | |
 \__/_/\_\___|_| |_| v1.1.0

Add, remove and re-associate hostname entries in your /etc/hosts file.
Read more including useage as a Go library at https://github.com/txn2/txeh

Usage:
  txeh [flags]
  txeh [command]

Available Commands:
  add         Add hostnames to /etc/hosts
  help        Help about any command
  remove      Remove a hostname or ip address
  version     Print the version number of txeh

Flags:
  -d, --dryrun         dry run, output to stdout (ignores quiet)
  -h, --help           help for txeh
  -q, --quiet          no output
  -r, --read string    (override) Path to read /etc/hosts file.
  -w, --write string   (override) Path to write /etc/hosts file.
```


```bash
# point the hostnames "test" and "test.two" to the local loopback
sudo txeh add 127.0.0.1 test test.two

# remove the hostname "test"
sudo txeh remove host test

# remove multiple hostnames 
sudo txeh remove host test test2 test.two

# remove an IP address and all the hosts that point to it
sudo txeh remove ip 93.184.216.34

# remove multiple IP addresses
sudo txeh remove ip 93.184.216.34 127.1.27.1

# remove CIDR ranges
sudo txeh remove cidr 93.184.216.0/24 127.1.27.0/28

# quiet mode will suppress output
sudo txeh remove ip 93.184.216.34 -q

# dry run will print a rendered /etc/hosts with your changes without
# saving it.
sudo txeh remove ip 93.184.216.34 -d

# use quiet mode and dry-run to direct the rendered /etc/hosts file
# to another file
sudo txeh add 127.1.27.100 dev.example.com -q -d > hosts.test

# specify an alternate /etc/hosts file to read. writing will
# default to the specified read path.
txeh add 127.1.27.100 dev2.example.com -q -r ./hosts.test

# specify a seperate read and write oath
txeh add 127.1.27.100 dev3.example.com -r ./hosts.test -w ./hosts.test2

```

## txeh Go Library

**Dependency:**
```bash
go get github.com/txn2/txeh
```

**Example Golang Implementation**:
```go

package main

import (
    "fmt"
    "strings"

    "github.com/txn2/txeh"
)

func main() {
    hosts, err := txeh.NewHostsDefault()
    if err != nil {
        panic(err)
    }

    hosts.AddHost("127.100.100.100", "test")
    hosts.AddHost("127.100.100.101", "logstash")
    hosts.AddHosts("127.100.100.102", []string{"a", "b", "c"})
    
    hosts.RemoveHosts([]string{"example", "example.machine", "example.machine.example.com"})
    hosts.RemoveHosts(strings.Fields("example2 example.machine2 example.machine.example.com2"))

    
    hosts.RemoveAddress("127.1.27.1")
    
    removeList := []string{
        "127.1.27.15",
        "127.1.27.14",
        "127.1.27.13",
    }
    
    hosts.RemoveAddresses(removeList)
    
    hfData := hosts.RenderHostsFile()

    // if you like to see what the outcome will
    // look like
    fmt.Println(hfData)
    
    hosts.Save()
    // or hosts.SaveAs("./test.hosts")
}

```

## Build Release

Build test release:
```bash
goreleaser --skip-publish --rm-dist --skip-validate
```

Build and release:
```bash
GITHUB_TOKEN=$GITHUB_TOKEN goreleaser --rm-dist
```

### License

Apache License 2.0

[/etc/hosts]:https://en.wikipedia.org/wiki/Hosts_(file)
