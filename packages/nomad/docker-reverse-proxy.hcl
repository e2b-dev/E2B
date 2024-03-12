variable "gcp_zone" {
  type    = string
  default = "us-central1-a"
}


variable "image_name" {
  type    = string
  default = ""
}

variable "port_number" {
  type    = number
  default = 0
}


job "docker-reverse-proxy" {
  datacenters = [var.gcp_zone]

  priority = 90

  group "reverse-proxy" {
    network {
      port "docker-reverse-proxy" {
        static = var.port_number
      }
    }

    service {
      name = "docker-reverse-proxy"
      port = var.port_number

      check {
        type     = "http"
        name     = "health"
        path     = "/health"
        interval = "20s"
        timeout  = "5s"
        port     = var.port_number
      }
    }

    task "start" {
      driver = "docker"

      resources {
        memory     = 1024
        memory_max = 1024
        cpu        = 512
      }
#
#      env {
#      }

      config {
        network_mode = "host"
        image        = var.image_name
        ports        = ["docker-reverse-proxy"]
        args = [
          "--port", "${var.port_number}",
        ]
      }
    }
  }
}
