#!/usr/bin/env bash

set -euo pipefail

# Change
# NS="6c258a8a-9304-4e82-a80b-aa2c0033abb0"
NS=ns$1
# VETH="veth4"
VETH=veth$1
# VETH_ADDR="10.0.3.1"
VETH_ADDR="10.0.$1.1"
# VPEER_ADDR="10.0.3.2"
VPEER_ADDR="10.0.$1.2"

# FC_HOST_IP="192.168.3.3"
FC_HOST_IP="192.168.$1.3"
#


MASK="/24"
VPEER="eth0"
FC_SNASPHOT_IP="169.254.0.21"


ip -n ${NS} link set lo up

ip -n ${NS} link add ${VETH} type veth peer name ${VPEER}
ip -n ${NS} addr add ${VPEER_ADDR}${MASK} dev ${VPEER}
ip -n ${NS} link set ${VPEER} up

ip -n ${NS} link set ${VETH} netns 1
ip link set ${VETH} up
ip addr add ${VETH_ADDR}${MASK} dev ${VETH}

ip -n ${NS} route add default via ${VETH_ADDR}


ip netns exec ${NS} iptables -t nat -A POSTROUTING -o ${VPEER} -s ${FC_SNASPHOT_IP} -j SNAT --to ${FC_HOST_IP}
ip netns exec ${NS} iptables -t nat -A PREROUTING -i ${VPEER} -d ${FC_HOST_IP} -j DNAT --to ${FC_SNASPHOT_IP}
ip route add ${FC_HOST_IP} via ${VPEER_ADDR}


iptables -A FORWARD -i ${VETH} -o ens4 -j ACCEPT
iptables -A FORWARD -i ens4 -o ${VETH} -j ACCEPT
iptables -t nat -A POSTROUTING -s ${FC_HOST_IP}/32 -o ens4 -j MASQUERADE


# mkdir -p "/etc/netns/$NS"
# ln -s /run/systemd/resolve/resolv.conf /etc/netns/"$NS"/resolv.conf
