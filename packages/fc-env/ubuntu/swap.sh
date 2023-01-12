# Setup swapfile in Ubuntu

# https://www.digitalocean.com/community/tutorials/how-to-add-swap-space-on-ubuntu-22-04

fallocate -l 500M /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
sysctl vm.swappiness=0
