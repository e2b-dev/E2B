output "server_proxy_ip" {
  value = module.server_cluster.server_proxy_ip
}

output "logs_proxy_ip" {
  value = module.client_cluster.logs_proxy_ip
}
