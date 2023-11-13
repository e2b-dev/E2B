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
)

func (a *APIStore) IdentifyAnalyticsTeam(teamID string, teamName string) {
	err := a.posthog.Enqueue(posthog.GroupIdentify{
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

func (a *APIStore) CreateAnalyticsTeamEvent(teamID, event string, properties posthog.Properties) {
	err := a.posthog.Enqueue(posthog.Capture{
		DistinctId: placeholderTeamGroupUser,
		Event:      event,
		Properties: properties,
		Groups: posthog.NewGroups().
			Set("team", teamID),
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "error when sending event to Posthog: %v\n", err)
	}
}

func (a *APIStore) CreateAnalyticsUserEvent(userID string, teamID string, event string, properties posthog.Properties) {
	err := a.posthog.Enqueue(posthog.Capture{
		DistinctId: userID,
		Event:      event,
		Properties: properties,
		Groups: posthog.NewGroups().
			Set("team", teamID),
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "error when sending event to Posthog: %v\n", err)
	}
}
