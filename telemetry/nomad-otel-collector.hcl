variable "gcp_zone" {
  type = string
}

variables {
  otel_image = "otel/opentelemetry-collector:0.54.0"
}

job "nomad-otel-collector" {
  datacenters = [var.gcp_zone]
  type        = "service"

  group "otel-collector" {
    count = 1

    network {
      port "metrics" {
        to = 8888
      }

      # Receivers
      port "grpc" {
        to = 4317
      }

      port "jaeger-grpc" {
        to = 14250
      }

      port "jaeger-thrift-http" {
        to = 14268
      }

      port "zipkin" {
        to = 9411
      }

      # Extensions
      port "zpages" {
        to = 55679
      }
    }

    service {
      name     = "otel-collector"
      port     = "grpc"
      tags     = ["grpc"]
      provider = "nomad"
    }

    task "otel-collector" {
      driver = "docker"

      config {
        image = var.otel_image

        entrypoint = [
          "/otelcol",
          "--config=local/config/otel-collector-config.yaml",
        ]

        ports = [
          "metrics",
          "grpc",
          "jaeger-grpc",
          "jaeger-thrift-http",
          "zipkin",
          "zpages",
        ]
      }

      resources {
        cpu    = 500
        memory = 1024
      }

      template {
        data = <<EOF
receivers:
  prometheus:
    config:
      scrape_configs:
        - job_name: 'nomad-server'
          scrape_inteval: 10s
          scrape_timeout: 20s
          metrics_path: '/v1/metrics?format=prometheus'
          params:
            format: ['prometheus']
          static_configs:
            - targets: ['localhost:4646']

exporters:
  otlp/metrics:
    endpoint: "api.honeycomb.io:443"
    headers:
      "x-honeycomb-team": "DfR4iT3PC1ImOt8HGSwOdB"
      "x-honeycomb-dataset": "nomad"

service:
  pipelines:
    metrics:
      receivers: [prometheus]
      processors: []
      exporters: [otlp/metrics]
EOF

        destination = "local/config/otel-collector-config.yaml"
      }
    }
  }
}
