# QEMU invocation shared by build (savevm) and run (loadvm): a loadvm needs the same machine.
WIN_DIR=${WIN_DIR:-/opt/win}
WIN_MEM=${WIN_MEM:-4096}
WIN_SMP=${WIN_SMP:-4}
WIN_RDP_PORT=${WIN_RDP_PORT:-3389}

# Explicit Hyper-V enlightenments: hv_passthrough and migratable=no make the vCPU
# non-migratable and QEMU refuses savevm. -vmx hides nesting from Windows.
QEMU_ARGS=(
  -name win -machine q35,smm=off,accel=kvm,graphics=off,vmport=off,hpet=off -enable-kvm
  -cpu host,kvm=on,-vmx,+hypervisor,hv_relaxed,hv_vapic,hv_spinlocks=0x1fff,hv_time,hv_frequencies,hv_vpindex,hv_runtime
  -smp "$WIN_SMP" -m "$WIN_MEM"
  -drive if=pflash,unit=0,format=raw,readonly=on,file="$WIN_DIR/OVMF_CODE.fd"
  -drive if=pflash,unit=1,format=qcow2,file="$WIN_DIR/OVMF_VARS.qcow2"
  -drive file="$WIN_DIR/win.qcow2",id=data,format=qcow2,cache=writeback,if=none
  -device virtio-scsi-pci,id=scsi0 -device scsi-hd,drive=data,bus=scsi0.0,bootindex=1
  -netdev user,id=n0,hostfwd=tcp:0.0.0.0:"$WIN_RDP_PORT"-:3389 -device virtio-net-pci,netdev=n0
  -device qemu-xhci -device usb-tablet -vga virtio -vnc 127.0.0.1:0
  -qmp unix:"$WIN_DIR/qmp.sock",server,nowait -display none -pidfile "$WIN_DIR/qemu.pid"
  -rtc base=localtime -global ICH9-LPC.disable_s3=1 -global ICH9-LPC.disable_s4=1
)
