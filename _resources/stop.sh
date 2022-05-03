curl --unix-socket /tmp/firecracker.socket -i \
    -X PATCH 'http://localhost/vm' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -d '{
            "state": "Paused"
    }'
  