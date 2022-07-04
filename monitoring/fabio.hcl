variable "gcp_zone" {
  type = string
}

job "fabio" {
  datacenters = [var.gcp_zone]
  type        = "system"

  group "fabio" {
    task "fabio" {
      driver = "docker"
      config {
        image        = "fabiolb/fabio"
        network_mode = "host"
      }

      resources {
        cpu    = 100
        memory = 64
        network {
          port "lb" {
            static = 9999
          }
          port "ui" {
            static = 9998
          }
        }
      }
    }
  }
}
