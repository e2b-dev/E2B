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
        static = 3003
      }
    }

    service {
      name = "session-proxy"
      port = "http"
      meta {
        Client = "${node.unique.id}"
      }
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
        left_delimiter  = "[["
        right_delimiter = "]]"
        destination   = "local/load-balancer.conf"
        change_mode   = "signal"
        change_signal = "SIGHUP"
        data = <<EOF
map $host $dbk_session_id {
  default         "";
  "~^(?<s>\w+)_"  $s;
}

server {
  listen 3003;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;

  location / {
    if ($dbk_session_id = "") {
      return 400 'Missing session ID';
    }
    proxy_pass $scheme://$dbk_session_id$request_uri;
  }
}
EOF
      }
    }
  }
}
