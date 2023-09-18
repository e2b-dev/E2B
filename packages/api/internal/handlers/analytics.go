package handlers

import (
	"fmt"

	"github.com/posthog/posthog-go"
)

const teamGroup = "team"
const placeholderTeamGroupUser = "backend"

func (a *APIStore) IdentifyAnalyticsTeam(teamID string) {
	err := a.posthog.Enqueue(posthog.GroupIdentify{
		Type: teamGroup,
		Key:  teamID,
		Properties: posthog.NewProperties().
			Set("session_tried", true),
	},
	)
	if err != nil {
		fmt.Printf("Error when setting group property in Posthog: %+v\n", err)
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
		fmt.Printf("Error when sending event to Posthog: %+v\n", err)
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
		fmt.Printf("Error when sending event to Posthog: %+v\n", err)
	}
}
