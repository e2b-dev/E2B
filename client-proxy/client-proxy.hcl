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

  priority = 60

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
  server_name ~^(.+)-[[ index .ServiceMeta "Client" | sprig_substr 0 8 ]]\.ondevbook\.com$;
  
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;

  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $conn_upgrade;

  proxy_read_timeout 7d;

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
}
EOF
      }
    }
  }
}
