# First start consul
#consul agent -dev -bind 0.0.0.0 -client 0.0.0.0  &
# Now nomad agent
nomad agent -dev -config=/home/build/go/src/github.com/cneira/firecracker-task-driver/config.hcl -data-dir=/home/build/go/src/github.com/cneira/firecracker-task-driver -plugin-dir=/home/build/go/src/github.com/cneira/firecracker-task-driver/plugin -bind=0.0.0.0 
