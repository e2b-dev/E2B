variable "gcp_zone" {
  type = string
}

job "client-proxy" {
  datacenters = [var.gcp_zone]

  group "client-proxy" {
    count = 1

    network {
      port "session" {
        static = 3001
      }
    }

    service {
      name = "client-proxy"
      port = "session"
    }

    task "nginx" {
      driver = "docker"

      config {
        image = "nginx"

        ports = ["session"]

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
[[ range services ]]
  [[ if .Name eq "session-proxy" ]]
    server {
      listen 3002;
      server_name *_[[ .Meta.Client ]].ondevbook.com;
      proxy_set_header Host [["$host"]];
      proxy_set_header X-Real-IP [["$remote_addr"]];

      location / {
        proxy_pass http://[[ .Address ]]:[[ .Port ]][["$request_uri"]];
      }
    }
  [[ end ]]
[[ end ]]

server {
  listen 3001;

  location /health {
    access_log off;
    add_header 'Content-Type' 'text/plain';
    return 200 "healthy\n";
  }
}
EOF
      }
    }
  }
}
