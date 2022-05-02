#!/bin/bash

set -e

# Import the appropriate bash commons libraries
readonly BASH_COMMONS_DIR="/opt/gruntwork/bash-commons"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

readonly DEFAULT_CONSUL_DOMAIN="consul"
readonly DEFAULT_CONSUL_IP="127.0.0.1"
readonly DEFAULT_CONSUL_DNS_PORT=8600

readonly DNS_MASQ_CONFIG_DIR="/etc/dnsmasq.d"
readonly CONSUL_DNS_MASQ_CONFIG_FILE="$DNS_MASQ_CONFIG_DIR/10-consul"

if [[ ! -d "$BASH_COMMONS_DIR" ]]; then
  echo "ERROR: this script requires that bash-commons is installed in $BASH_COMMONS_DIR. See https://github.com/gruntwork-io/bash-commons for more info."
  exit 1
fi

source "$BASH_COMMONS_DIR/assert.sh"
source "$BASH_COMMONS_DIR/log.sh"
source "$BASH_COMMONS_DIR/os.sh"

function print_usage {
  echo
  echo "Usage: install-dnsmasq [OPTIONS]"
  echo
  echo "Install Dnsmasq and configure it to forward requests for a specific domain to Consul. This script has been tested with Ubuntu 18.04."
  echo
  echo "Options:"
  echo
  echo -e "  --consul-domain\tThe domain name to point to Consul. Optional. Default: $DEFAULT_CONSUL_DOMAIN."
  echo -e "  --consul-ip\t\tThe IP address to use for Consul. Optional. Default: $DEFAULT_CONSUL_IP."
  echo -e "  --consul-dns-port\tThe port Consul uses for DNS. Optional. Default: $DEFAULT_CONSUL_DNS_PORT."
  echo
  echo "Example:"
  echo
  echo "  install-dnsmasq"
}

function install_dnsmasq {
  local -r consul_ip="$1"

  log_info "Installing Dnsmasq"

  if os_is_ubuntu; then
    sudo apt-get update -y
    sudo apt-get install -y dnsmasq
  else
    log_error "Could not find apt-get. Cannot install on this OS."
    exit 1
  fi
}

function write_consul_config {
  local -r consul_domain="$1"
  local -r consul_ip="$2"
  local -r consul_port="$3"

  log_info "Configuring Dnsmasq to forward lookups of the '$consul_domain' domain to $consul_ip:$consul_port in $CONSUL_DNS_MASQ_CONFIG_FILE"
  mkdir -p "$DNS_MASQ_CONFIG_DIR"

  sudo tee "$CONSUL_DNS_MASQ_CONFIG_FILE" <<EOF
# Enable forward lookup of the '$consul_domain' domain:
server=/${consul_domain}/${consul_ip}#${consul_port}
listen-address=${consul_ip}
bind-interfaces
EOF
}

function write_consul_config {
  local -r consul_domain="$1"
  local -r consul_ip="$2"
  local -r consul_port="$3"

  log_info "Configuring Dnsmasq to forward lookups of the '$consul_domain' domain to $consul_ip:$consul_port in $CONSUL_DNS_MASQ_CONFIG_FILE"
  mkdir -p "$DNS_MASQ_CONFIG_DIR"

  sudo tee "$CONSUL_DNS_MASQ_CONFIG_FILE" <<EOF
# Enable forward lookup of the '$consul_domain' domain:
server=/${consul_domain}/${consul_ip}#${consul_port}
listen-address=${consul_ip}
bind-interfaces
EOF
}

function install {
  local consul_domain="$DEFAULT_CONSUL_DOMAIN"
  local consul_ip="$DEFAULT_CONSUL_IP"
  local consul_dns_port="$DEFAULT_CONSUL_DNS_PORT"

  while [[ $# -gt 0 ]]; do
    local key="$1"

    case "$key" in
      --consul-domain)
        assert_not_empty "$key" "$2"
        consul_domain="$2"
        shift
        ;;
      --consul-ip)
        assert_not_empty "$key" "$2"
        consul_ip="$2"
        shift
        ;;
      --consul-dns-port)
        assert_not_empty "$key" "$2"
        consul_dns_port="$2"
        shift
        ;;
      --help)
        print_usage
        exit
        ;;
      *)
        log_error "Unrecognized argument: $key"
        print_usage
        exit 1
        ;;
    esac

    shift
  done

  log_info "Starting Dnsmasq install"
  install_dnsmasq "$consul_ip"
  write_consul_config "$consul_domain" "$consul_ip" "$consul_dns_port"
  log_info "Dnsmasq install complete!"
}

install "$@"
