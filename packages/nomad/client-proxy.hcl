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
        memory_max = 6000
        memory = 6000
        cpu    = 2048
      }

      config {
        image        = "nginx:1.27.0"
        network_mode = "host"
        ports        = [var.client_proxy_health_port_name, var.client_proxy_port_name]
        volumes = [
          "local:/etc/nginx/conf.d",
          "/var/log/client-proxy:/var/log/nginx"
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

log_format logger-json escape=json
'{'
'"source": "client-proxy",'
'"time": "$time_iso8601",'
'"resp_body_size": $body_bytes_sent,'
'"host": "$http_host",'
'"address": "$remote_addr",'
'"request_length": $request_length,'
'"method": "$request_method",'
'"uri": "$request_uri",'
'"status": $status,'
'"user_agent": "$http_user_agent",'
'"resp_time": $request_time,'
'"upstream_addr": "$upstream_addr"'
'}';
access_log /var/log/nginx/access.log logger-json;

server {
  listen 3002 default_server;

  server_name _;
  return 400 "Unsupported domain";
}
[[ range service "session-proxy" ]]
server {
  listen 3002;
  access_log /var/log/nginx/access.log logger-json;

  server_name ~^(.+)-[[ index .ServiceMeta "Client" | sprig_substr 0 8 ]]\.${local.domain_name_escaped}$;

  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;

  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $conn_upgrade;

  proxy_hide_header x-frame-options;

  proxy_http_version 1.1;

  client_body_timeout 86400s;
  client_header_timeout 30s;

  proxy_read_timeout 600s;
  proxy_send_timeout 86400s;

  proxy_cache_bypass 1;
  proxy_no_cache 1;

  client_max_body_size 1024m;

  proxy_buffering off;
  proxy_request_buffering off;

  tcp_nodelay on;
  tcp_nopush on;
  sendfile on;

  send_timeout                600s;

  proxy_connect_timeout       30s;

  keepalive_requests 65536;
  keepalive_timeout 600s;
  # TODO: Fix the config file so we can defined this
  # keepalive_time: 86400s;

  gzip off;

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
    access_log off;
    stub_status;
    allow all;
  }
}
EOF
      }
    }
  }
}
