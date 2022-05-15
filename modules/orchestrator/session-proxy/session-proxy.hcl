variable "gcp_zone" {
  type = string
}

variable "client_cluster_size" {
  type = number
}

job "session-proxy" {
  datacenters = [var.gcp_zone]

  constraint {
    operator  = "distinct_hosts"
    value     = "true"
  }

  group "session-proxy" {
    count = var.client_cluster_size

    network {
      port "http" {
        static = 8080
      }
    }

    service {
      tags = ["${node.unique.name}"]
      name = "session-proxy"
      port = "http"
    }

    task "session-proxy" {
      driver = "docker"

      config {
        image = "nginx"
        network_mode = "host"
        ports = ["http"]
        volumes = [
          "local:/etc/nginx/conf.d",
        ]
      }

      template {
        data = <<EOF
map $host $dbk_session_id {
  default   "";
  "~^(?<sessid>\w+)_\w+\.ondevbook\.com$" $sessid;
}

server {
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;

  location / {
    proxy_pass $scheme://$dbk_sess_id$request_uri permanent;
  }
}
EOF
        destination   = "local/load-balancer.conf"
        change_mode   = "signal"
        change_signal = "SIGHUP"
      }
    }
  }
}
