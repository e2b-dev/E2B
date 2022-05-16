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
  type  = string
}

job "client-proxy" {
  datacenters = [var.gcp_zone]

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
    }

    task "client-proxy" {
      driver = "docker"

      config {
        image = "nginx"
        ports = [var.client_proxy_health_port_name, var.client_proxy_port_name]
        volumes = [
          "local:/etc/nginx/conf.d",
        ]
      }

      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        destination   = "local/load-balancer.conf"
        change_mode   = "signal"
        change_signal = "SIGHUP"
        data            = <<EOF
server {
  listen [[ var.client_proxy_port_number ]] default_server;
  server_name _;
  return 400 'Unexpected request host format';
}
[[ range service var.session_proxy_service_name ]]
server {
  listen [[ var.client_proxy_port_number ]];
  server_name ~^(.+)_[[ index .ServiceMeta "Client" ]]\.ondevbook\.com$;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  location / {
    proxy_pass $scheme://[[ .Address ]]:[[ .Port ]]$request_uri;
  }
}
[[ end ]]
server {
  listen [[ var.client_proxy_health_port_number ]];
  location [[ client_proxy_health_port_path ]] {
    access_log off;
    add_header 'Content-Type' 'application/json';
    return 200 '{"status":"UP"}';
  }
}
EOF
      }
    }
  }
}
