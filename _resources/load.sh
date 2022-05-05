curl --unix-socket /tmp/firecracker.socket -i \
    -X PUT 'http://localhost/snapshot/load' \
    -H  'Accept: application/json' \
    -H  'Content-Type: application/json' \
    -d '{
            "snapshot_path": "/fc-vm/snapshot_file",
            "mem_file_path": "/fc-vm/mem_file",
            "enable_diff_snapshots": false,
            "resume_vm": true
    }'