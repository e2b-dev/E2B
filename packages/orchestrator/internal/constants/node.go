package constants

import "os"

const shortNodeIDLength = 8

var (
	nodeID   = os.Getenv("NODE_ID")
	ClientID = nodeID[:shortNodeIDLength]
)
