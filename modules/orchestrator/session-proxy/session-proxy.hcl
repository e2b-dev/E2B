variable "gcp_zone" {
  type = string
}

job "session-proxy" {
  datacenters = [var.gcp_zone]

  group "session-proxy" {
    network {
      port "http" {
        static = 8080
      }
    }

    service {
      tags = [${node.unique.name}]
      name = "session-proxy"
      port = "http"
    }

    task "session-proxy" {
      driver = "docker"

      config {
        image = "nginx"
        network_mode = "host"
        ports = ["http"]
      }

    volumes = [
        "local:/etc/nginx/conf.d",
      ]
    }

    template {
      data = <<EOF
server {
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;

  # $http_custom_header --> Custom-Header
  # Expected HTTP headers
  # DBK-Session-ID: <session-id>
  # DBK-Port: <port>

  location / {
    # proxy_pass $scheme://$subdomain$request_uri permanent;
    proxy_pass $scheme://$http_dbk_session_id$request_uri permanent;
  }
}
EOF
      destination   = "local/load-balancer.conf"
      change_mode   = "signal"
      change_signal = "SIGHUP"
    }
  }
}
