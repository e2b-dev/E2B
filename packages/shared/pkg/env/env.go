package env

import "os"

var environment = os.Getenv("ENVIRONMENT")

func IsProduction() bool {
	return environment == "prod"
}
