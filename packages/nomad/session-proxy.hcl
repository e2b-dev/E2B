variable "gcp_zone" {
  type = string
}

variable "client_cluster_size" {
  type = number
}

variable "session_proxy_port_number" {
  type = number
}

variable "session_proxy_port_name" {
  type = string
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

job "session-proxy" {
  type = "system"
  datacenters = [var.gcp_zone]

  priority = 80


  group "session-proxy" {
    network {
      port "session" {
        static = var.session_proxy_port_number
      }
      port "status" {
        static = 3004
      }
    }

    service {
      name = var.session_proxy_service_name
      port = var.session_proxy_port_name
      meta {
        Client = node.unique.id
      }

      check {
        type     = "http"
        name     = "health"
        path     = "/health"
        interval = "20s"
        timeout  = "5s"
        port     = "status"
      }

    }

    task "session-proxy" {
      driver = "docker"

      config {
        image        = "nginx:1.27.0"
        network_mode = "host"
        ports        = [var.session_proxy_port_name, "status"]
        volumes = [
          "local:/etc/nginx/",
          "/var/log/session-proxy:/var/log/nginx"
        ]
      }

      resources {
        memory_max = 2048
        memory = 1024
        cpu    = 1024
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