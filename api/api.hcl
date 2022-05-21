variable "gcp_zone" {
  type = string
}

variable "image_name" {
  type = string
}

variable "api_port_name" {
  type = string
}

variable "api_port_number" {
  type = number
}

job "orchestration-api" {
  datacenters = [var.gcp_zone]

  priority = 90

  group "api-service" {
    network {
      port "api" {
        static = var.api_port_number
      }
    }

    service {
      name = "api"
      port = var.api_port_number
    }

    task "start" {
      driver = "docker"
      config {
        image = var.image_name
        ports = [var.api_port_name]
      }
    }
  }
}
