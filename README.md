# Orchestration Services

Backend services for handling VM sessions, environments' pipeline, and the API for them.


## Development

If you get stuck with a non-working Nomad on all VMs and therefore you are not able to change the infrastructure because the Nomad jobs that are supposedly running there cannot be reached use the:
```
sudo nomad agent -dev -bind 0.0.0.0 -log-level INFO
```

to start temporary Nomad on any server and tear it all down with `terraform apply -destroy`.
