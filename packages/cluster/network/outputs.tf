output "logs_proxy_ip" {
  value = module.gce_lb_http_logs.external_ip
}
