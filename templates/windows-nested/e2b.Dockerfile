# Experimental: a Windows guest under QEMU/KVM inside the sandbox, reachable
# over noVNC (:6080) and RDP (:3389). See README.md for the prerequisites.
FROM debian:12

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  qemu-system-x86 qemu-utils novnc websockify python3 procps ca-certificates && \
  rm -rf /var/lib/apt/lists/*

# Produced by image/build-disk.sh; never committed.
ARG WIN_DISK=image/win.qcow2
ARG OVMF_CODE=image/OVMF_CODE.fd
ARG OVMF_VARS=image/OVMF_VARS.qcow2

# The disk layer first so script edits below do not re-copy it.
COPY ${WIN_DISK} /opt/win/win.qcow2
COPY ${OVMF_CODE} /opt/win/OVMF_CODE.fd
COPY ${OVMF_VARS} /opt/win/OVMF_VARS.qcow2
COPY win/ /opt/win/
RUN chmod +x /opt/win/*.sh /opt/win/*.py
