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

variable "domain_name" {
  type = string
}

locals {
  domain_name_escaped = replace(var.domain_name, ".", "\\.")
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
        max_memory = 2048
        memory = 512
        cpu    = 512
      }

      config {
        image        = "nginx"
        network_mode = "host"
        ports        = [var.client_proxy_health_port_name, var.client_proxy_port_name]
        volumes = [
          "local:/etc/nginx/conf.d",
        ]
      }

      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        destination     = "local/load-balancer.conf"
        change_mode     = "signal"
        change_signal   = "SIGHUP"
        data            = <<EOF
map $http_upgrade $conn_upgrade {
  default     "";
  "websocket" "Upgrade";
}

server {
  listen 3002 default_server;
  server_name _;
  return 400 "Unsupported domain";
}
[[ range service "session-proxy" ]]
server {
  listen 3002;
  server_name ~^(.+)-[[ index .ServiceMeta "Client" | sprig_substr 0 8 ]]\.${local.domain_name_escaped}$;

  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;

  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $conn_upgrade;

  proxy_hide_header x-frame-options;

  proxy_http_version 1.1;

  proxy_read_timeout 7d;
  proxy_send_timeout 7d;

  proxy_cache_bypass 1;
  proxy_no_cache 1;

  client_max_body_size 100M;

  location / {
    proxy_pass $scheme://[[ .Address ]]:[[ .Port ]]$request_uri;
  }
}
[[ end ]]
server {
  listen 3001;
  location /health {
    access_log off;
    add_header 'Content-Type' 'application/json';
    return 200 '{"status":"UP"}';
  }

  location /status {
    stub_status;
    allow all;
  }
}
EOF
      }
    }
  }
}
