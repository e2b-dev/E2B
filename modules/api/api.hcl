variable "gcp_zone" {
  type = string
}

variable "session_proxy_port_number" {
  type = number
}

variable "session_proxy_port_name" {
  type  = string
}

variable "session_proxy_service_name" {
  type  = string
}



job "orchestration-api" {
  datacenters = [var.gcp_zone]

  priority = 90

  group "api" {
    count = var.client_cluster_size

    meta {
      label1 = "group"
    }

    network {
      port "session" {
        static = var.session_proxy_port_number
      }
    }

    service {
      name = var.session_proxy_service_name
      port = var.session_proxy_port_name
    }

    task "api" {
      driver = "docker"
      config {
        image = "nginx"
        network_mode = "host"
        ports = [var.session_proxy_port_name]
      }
    }
  }
}
