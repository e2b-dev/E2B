package env

import "os"

var environment = getEnv("ENVIRONMENT", "local")

func IsProduction() bool {
	return environment == "prod"
}

func IsLocal() bool {
	return environment == "local"
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if len(value) == 0 {
		return defaultValue
	}
	return value
}
