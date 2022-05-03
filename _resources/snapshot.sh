curl --unix-socket /tmp/firecracker.socket -i \
    -X PUT 'http://localhost/snapshot/create' \
    -H  'Accept: application/json' \
    -H  'Content-Type: application/json' \
    -d '{
            "snapshot_type": "Full",
            "snapshot_path": "/fc-vm/snapshot_file_1",
            "mem_file_path": "/fc-vm/mem_file_1"
    }'