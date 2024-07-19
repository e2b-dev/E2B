variable "gcp_zone" {
  type = string
}

variable "client_proxy_health_port_name" {
  type = string
}

variable "client_proxy_health_port_number" {
  type = number
}

variable "client_proxy_health_port_path" {
  type = string
}

variable "client_proxy_port_name" {
  type = string
}

variable "client_proxy_port_number" {
  type = number
}

variable "session_proxy_service_name" {
  type = string
}

variable "load_balancer_conf" {
  type = string
}

variable "nginx_conf" {
  type = string
}

job "client-proxy" {
  datacenters = [var.gcp_zone]

  priority = 80

  group "client-proxy" {
    network {
      port "health" {
        static = var.client_proxy_health_port_number
      }
      port "session" {
        static = var.client_proxy_port_number
      }
    }

    service {
      name = "client-proxy"
      port = var.client_proxy_port_name

      check {
        type     = "http"
        name     = "health"
        path     = "/health"
        interval = "20s"
        timeout  = "5s"
        port     = "health"
      }
    }

    task "client-proxy" {
      driver = "docker"

      resources {
        memory_max = 6000
        memory = 6000
        cpu    = 2048
      }

      config {
        image        = "nginx:1.27.0"
        network_mode = "host"
        ports        = [var.client_proxy_health_port_name, var.client_proxy_port_name]
        volumes = [
          "local:/etc/nginx/",
          "/var/log/client-proxy:/var/log/nginx"
        ]
      }

      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data            = var.load_balancer_conf
        destination     = "local/conf.d/load-balancer.conf"
        change_mode     = "signal"
        change_signal   = "SIGHUP"
      }

      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        data            = var.nginx_conf
        destination     = "local/nginx.conf"
        change_mode     = "signal"
        change_signal   = "SIGHUP"
      }
    }
  }
}
