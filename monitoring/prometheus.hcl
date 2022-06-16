variable "gcp_zone" {
  type = string
}

job "prometheus" {
  datacenters = [var.gcp_zone]

  group "prometheus" {
    count = 1

    network {
      port "prometheus_ui" {}
    }

    task "prometheus" {
      driver = "docker"

      config {
        image = "prom/prometheus"
        ports = ["prometheus_ui"]

        # Use `host` network so we can communicate with the Nomad and Consul
        # agents running in the host and scrape their metrics.
        network_mode = "host"

        args = [
          "--config.file=/etc/prometheus/config/prometheus.yml",
          "--storage.tsdb.path=/prometheus",
          "--web.listen-address=0.0.0.0:${NOMAD_PORT_prometheus_ui}",
          "--web.console.libraries=/usr/share/prometheus/console_libraries",
          "--web.console.templates=/usr/share/prometheus/consoles"
        ]

        volumes = [
          "local/config:/etc/prometheus/config",
        ]
      }

      template {
        data = <<EOH
---
global:
  scrape_interval:     1s
  evaluation_interval: 1s
scrape_configs:
  - job_name: 'nomad_metrics'
    consul_sd_configs:
    - server: '172.16.1.101:8500'
      services: ['nomad-client', 'nomad']
    relabel_configs:
    - source_labels: ['__meta_consul_tags']
      regex: '(.*)http(.*)'
      action: keep
    scrape_interval: 5s
    metrics_path: /v1/metrics
    params:
      format: ['prometheus']
  - job_name: 'actuator'
    metrics_path: /petclinicapi/actuator/prometheus
    consul_sd_configs:
    - server: '172.16.1.101:8500'
      services: ['api']
      
    relabel_configs:
    - source_labels: ['__meta_consul_tags']
      regex: ',addr:(.*),'
      target_label: '__address__'
      replacement: '$1'
      action: replace
    scrape_interval: 5s
    params:
      format: ['prometheus']
  - job_name: nomad_autoscaler
    metrics_path: /v1/metrics
    params:
      format: ['prometheus']
    static_configs:
      - targets: [{{ range service "autoscaler" }}'{{ .Address }}:{{ .Port }}',{{ end }}]
EOH

        change_mode   = "signal"
        change_signal = "SIGHUP"
        destination   = "local/config/prometheus.yml"
      }

      resources {
        cpu    = 100
        memory = 256
      }

      service {
        name = "prometheus"
        port = "prometheus_ui"
        tags = ["urlprefix-/"]

        check {
          type     = "http"
          path     = "/"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}
