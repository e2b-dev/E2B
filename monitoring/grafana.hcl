job "grafana" {
  datacenters = ["us-central1-a"]
  type        = "service"

  constraint {
    attribute = attr.kernel.name
    value     = "linux"
  }

  update {
    stagger      = "30s"
    max_parallel = 1
  }

  group "grafana" {
    restart {
      attempts = 10
      interval = "5m"
      delay    = "10s"
      mode     = "delay"
    }

    task "grafana" {
      driver = "docker"
      config {
        image = "grafana/grafana"
      }

      env {
        GF_LOG_LEVEL          = "DEBUG"
        GF_LOG_MODE           = "console"
        GF_SERVER_HTTP_PORT   = NOMAD_PORT_http
        GF_PATHS_PROVISIONING = "/local/provisioning"
      }

      # artifact {
      #   source      = "github.com/burdandrei/nomad-monitoring/examples/grafana/provisioning"
      #   destination = "local/provisioning/"
      # }

      # artifact {
      #   source      = "github.com/burdandrei/nomad-monitoring/examples/grafana/dashboards"
      #   destination = "local/dashboards/"
      # }

      resources {
        cpu    = 1000
        memory = 256
        network {
          mbits = 10
          port "http" {}
        }
      }

      service {
        name = "grafana"
        port = "http"
        check {
          name     = "Grafana HTTP"
          type     = "http"
          path     = "/api/health"
          interval = "5s"
          timeout  = "2s"
          check_restart {
            limit           = 2
            grace           = "60s"
            ignore_warnings = false
          }
        }
      }
    }
  }
}
