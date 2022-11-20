package api

import "os"

const (
	APIAdminKeyName = "API_ADMIN_KEY"
)

var APIAdminKey = os.Getenv(APIAdminKeyName)
