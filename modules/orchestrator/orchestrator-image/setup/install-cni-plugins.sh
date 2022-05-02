#!/bin/bash

set -e

# function install {
#   git clone https://github.com/awslabs/tc-redirect-tap
#   cd tc-redirect-tap
#   make

#   sudo mkdir -p /opt/cni/bin
#   sudo cp tc-redirect-tap /opt/cni/bin/

#   mkdir -p /tmp/download-cni
#   cd /tmp/download-cni
#   curl -L https://github.com/containernetworking/plugins/releases/download/v0.8.6/cni-plugins-linux-amd64-v0.8.6.tgz -o cni-plugins.tgz
#   sudo mkdir -p /opt/cni/bin
#   sudo tar -C /opt/cni/bin -xzf cni-plugins.tgz
#   rm -rf /tmp/download-cni

#   sudo sysctl -w net.bridge.bridge-nf-call-arptables=1
#   sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=1
#   sudo sysctl -w net.bridge.bridge-nf-call-iptables=1

#   # echo 1 > /proc/sys/net/bridge/bridge-nf-call-arptables
#   # echo 1 > /proc/sys/net/bridge/bridge-nf-call-ip6tables
#   # echo 1 > /proc/sys/net/bridge/bridge-nf-call-iptables
#   cat > /tmp/nomad-cni.conf <<EOF
#   net.bridge.bridge-nf-call-arptables=1
#   net.bridge.bridge-nf-call-ip6tables=1
#   net.bridge.bridge-nf-call-iptables=1
# EOF

#   sudo chown --recursive root:root /tmp/nomad-cni.conf
#   sudo mv /tmp/nomad-cni.conf /etc/sysctl.d/nomad-cni.conf
# }

# install


   
#!/bin/bash

set -ex

mkdir -p /tmp/download-cni
cd /tmp/download-cni
curl -L https://github.com/containernetworking/plugins/releases/download/v0.8.6/cni-plugins-linux-amd64-v0.8.6.tgz -o cni-plugins.tgz
sudo mkdir -p /opt/cni/bin
sudo tar -C /opt/cni/bin -xzf cni-plugins.tgz
rm -rf /tmp/download-cni


sudo sysctl -w net.bridge.bridge-nf-call-arptables=1
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=1
sudo sysctl -w net.bridge.bridge-nf-call-iptables=1

# echo 1 > /proc/sys/net/bridge/bridge-nf-call-arptables
# echo 1 > /proc/sys/net/bridge/bridge-nf-call-ip6tables
# echo 1 > /proc/sys/net/bridge/bridge-nf-call-iptables
cat > /tmp/nomad-cni.conf << EOF
net.bridge.bridge-nf-call-arptables=1
net.bridge.bridge-nf-call-ip6tables=1
net.bridge.bridge-nf-call-iptables=1
EOF
sudo chown --recursive root:root /tmp/nomad-cni.conf
sudo mv /tmp/nomad-cni.conf /etc/sysctl.d/nomad-cni.conf