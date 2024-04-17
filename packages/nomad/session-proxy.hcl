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

job "session-proxy" {
  type = "system"
  datacenters = [var.gcp_zone]

  priority = 80

  constraint {
    operator = "distinct_hosts"
    value    = "true"
  }

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
        image        = "nginx"
        network_mode = "host"
        ports        = [var.session_proxy_port_name, "status"]
        volumes = [
          "local:/etc/nginx/conf.d",
        ]
      }

      resources {
        memory_max = 2048
        memory = 512
        cpu    = 512
      }

      template {
        left_delimiter  = "[["
        right_delimiter = "]]"
        destination     = "local/load-balancer.conf"
        change_mode     = "signal"
        change_signal   = "SIGHUP"
        data            = <<EOF
map $host $dbk_port {
  default         "";
  "~^(?<p>\d+)-"  ":$p";
}

map $host $dbk_session_id {
  default         "";
  "~-(?<s>\w+)-"  $s;
}

map $http_upgrade $conn_upgrade {
  default     "";
  "websocket" "Upgrade";
}

server {
  listen 3003;
  # The IP addresses of sessions are saved in the /etc/hosts like so:
  # <session-id> <ip-address>
  #
  # By default, nginx won't use /etc/hosts for the name resolution.
  # We use the systemd nameserver to resolve against /etc/hosts.
  # See https://stackoverflow.com/questions/29980884/proxy-pass-does-not-resolve-dns-using-etc-hosts
  resolver 127.0.0.53;

  client_max_body_size 100M;

  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;

  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "Upgrade";

  proxy_hide_header x-frame-options;

  proxy_http_version 1.1;

  proxy_read_timeout 7d;
  proxy_send_timeout 7d;

  proxy_cache_bypass 1;
  proxy_no_cache 1;

  location / {
    if ($dbk_session_id = "") {
      return 400 "Unsupported session domain";
    }
    proxy_pass $scheme://$dbk_session_id$dbk_port$request_uri;
  }
}

server {
  listen 3004;

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
