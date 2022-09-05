variable "gcp_zone" {
  type = string
}

variable "lightstep_api_key" {
  type = string
}

variables {
  otel_image = "otel/opentelemetry-collector:0.54.0"
}

job "otel-collector" {
  datacenters = [var.gcp_zone]
  type        = "service"

  priority = 95

  group "collector" {
    count = 1

    network {
      port "metrics" {
        to = 8888
      }

      # Receivers
      port "grpc" {
        to = 4317
      }
    }

    service {
      name = "otel-collector"
      port = "grpc"
      tags = ["grpc"]
    }

    task "start-collector" {
      driver = "docker"

      config {
        network_mode = "host"
        image        = var.otel_image

        entrypoint = [
          "/otelcol",
          "--config=local/config/otel-collector-config.yaml",
        ]

        ports = [
          "metrics",
          "grpc",
        ]
      }

      resources {
        cpu    = 500
        memory = 512
      }

      template {
        data = <<EOF
receivers:
  prometheus:
    config:
      scrape_configs:
        - job_name: prometheus
          scrape_interval: 10s
          scrape_timeout: 8s
          metrics_path: '/v1/metrics'
          params:
            format: ['prometheus']
          static_configs:
            - targets: ['localhost:4646']

exporters:
  logging:
    loglevel: debug
  otlp/lightstep:
    endpoint: ingest.lightstep.com:443
    headers:
      "lightstep-access-token": ${var.lightstep_api_key}

service:
  telemetry:
    logs:
      level: debug
  pipelines:
    metrics:
      receivers: [prometheus]
      exporters: [otlp/lightstep, logging]
EOF

        destination = "local/config/otel-collector-config.yaml"
      }
    }
  }
}
