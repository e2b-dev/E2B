package handlers

import (
	"fmt"
	"os"

	"github.com/posthog/posthog-go"
)

const (
	teamGroup                = "team"
	placeholderTeamGroupUser = "backend"
	placeholderProperty      = "first interaction"

	infraVersionKey = "infra_version"
	infraVersion    = "v1"
)

func IdentifyAnalyticsTeam(client posthog.Client, teamID string, teamName string) {
	err := client.Enqueue(posthog.GroupIdentify{
		Type: teamGroup,
		Key:  teamID,
		Properties: posthog.NewProperties().
			Set(placeholderProperty, true).
			Set("name", teamName),
	},
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error when setting group property in Posthog: %v\n", err)
	}
}

func CreateAnalyticsTeamEvent(client posthog.Client, teamID, event string, properties posthog.Properties) {
	err := client.Enqueue(posthog.Capture{
		DistinctId: placeholderTeamGroupUser,
		Event:      event,
		Properties: properties.Set(infraVersionKey, infraVersion),
		Groups: posthog.NewGroups().
			Set("team", teamID),
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "error when sending event to Posthog: %v\n", err)
	}
}

func CreateAnalyticsUserEvent(client posthog.Client, userID string, teamID string, event string, properties posthog.Properties) {
	err := client.Enqueue(posthog.Capture{
		DistinctId: userID,
		Event:      event,
		Properties: properties.Set(infraVersionKey, infraVersion),
		Groups: posthog.NewGroups().
			Set("team", teamID),
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "error when sending event to Posthog: %v\n", err)
	}
}
