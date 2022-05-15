job "repeater" {
  datacenters = ["us-central1-a"]
  type = "service"

  group "start" {
    count = 1

    network {
      port "rep" { 
        static = 3001
      }
    }

    task "start" {
      driver = "docker"

      config {
        image = "us-central1-docker.pkg.dev/devbookhq/repeater/repeater"
        ports = ["rep"]
      }
    }
  }
}
