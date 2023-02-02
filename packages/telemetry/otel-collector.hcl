variable "gcp_zone" {
  type = string
}

variable "lightstep_api_key" {
  type = string
}

variables {
  otel_image = "otel/opentelemetry-collector-contrib:0.59.0"
}

job "otel-collector" {
  datacenters = [var.gcp_zone]
  type        = "service"

  priority = 95

  group "collector" {
    count = 1

    network {
      port "health" {
        to = 13133
      }

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

      check {
        type     = "http"
        name     = "health"
        path     = "/health"
        interval = "20s"
        timeout  = "5s"
        port     = 13133
      }
    }

    task "start-collector" {
      driver = "docker"

      config {
        network_mode = "host"
        image        = var.otel_image

        args = [
          "--config=local/config/otel-collector-config.yaml",
        ]

        ports = [
          "metrics",
          "grpc",
          "health",
        ]
      }

      resources {
        memory = 128
        cpu    = 200
      }

      template {
        data = <<EOF
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: '0.0.0.0:4317'
  nginx/client-proxy:
    endpoint: 'http://localhost:3001/status'
    collection_interval: 10s
  nginx/session-proxy:
    endpoint: 'http://localhost:3004/status'
    collection_interval: 10s
  hostmetrics:
    collection_interval: 30s
    scrapers:
      cpu:
      disk:
      filesystem:
      load:
      memory:
      network:
      paging:
      process:
        metrics:
          process.memory.physical_usage:
            enabled: false
          process.memory.virtual_usage:
            enabled: false
          process.memory.usage:
            enabled: true
          process.memory.virtual:
            enabled: true
      processes:
  prometheus:
    config:
      scrape_configs:
        - job_name: nomad
          scrape_interval: 10s
          scrape_timeout: 5s
          metrics_path: '/v1/metrics'
          params:
            format: ['prometheus']
          static_configs:
            - targets: ['localhost:4646']
        - job_name: consul
          scrape_interval: 10s
          scrape_timeout: 5s
          metrics_path: '/v1/agent/metrics'
          params:
            format: ['prometheus']
          static_configs:
            - targets: ['localhost:8500']

processors:
  attributes/session-proxy:
    actions:
      - key: proxy
        value: session
        action: upsert
  attributes/client-proxy:
    actions:
      - key: proxy
        value: client
        action: upsert
  batch:
    timeout: 5s
  resourcedetection:
    detectors: [gcp]
    timeout: 10s
  memory_limiter:
    check_interval: 1s
    limit_percentage: 65
    spike_limit_percentage: 20

extensions:
  health_check:

exporters:
  otlp/lightstep:
    endpoint: ingest.lightstep.com:443
    headers:
      "lightstep-access-token": ${var.lightstep_api_key}
  googlecloud:
    # Google Cloud Monitoring returns an error if any of the points are invalid, but still accepts the valid points.
    # Retrying successfully sent points is guaranteed to fail because the points were already written.
    # This results in a loop of unnecessary retries.  For now, disable retry_on_failure.
    retry_on_failure:
      enabled: false
    log:
      default_log_name: opentelemetry.io/collector-exported-log
service:
  extensions: [health_check]
  telemetry:
    logs:
      level: debug
  pipelines:
    metrics/client-proxy:
      receivers:
        - nginx/client-proxy
      processors: [attributes/client-proxy, batch]
      exporters:
        - otlp/lightstep
    metrics/session-proxy:
      receivers:
        - nginx/session-proxy
      processors: [attributes/session-proxy, batch]
      exporters:
        - otlp/lightstep
    metrics/gcp:
      receivers: 
        - hostmetrics
      processors: [memory_limiter, batch]
      exporters:
        - otlp/lightstep
    metrics:
      receivers: 
        - prometheus
        - hostmetrics
        - otlp
      processors: [batch]
      exporters:
        - otlp/lightstep
    traces:
      receivers:
        - otlp
      processors: [batch]
      exporters:
        - otlp/lightstep
    logs:
      receivers:
        - otlp
      processors: [batch]
      exporters:
        - otlp/lightstep
    
EOF

        destination = "local/config/otel-collector-config.yaml"
      }
    }
  }
}
