package instance

import (
	"fmt"

	"github.com/e2b-dev/infra/packages/shared/pkg/smap"

	"github.com/google/uuid"
)

type Reservation struct {
	instanceID string
	team       uuid.UUID
}

type ReservationCache struct {
	reservations *smap.Map[*Reservation]
}

func NewReservationCache() *ReservationCache {
	return &ReservationCache{
		reservations: smap.New[*Reservation](),
	}
}

func (r *ReservationCache) reserve(instanceID string, team uuid.UUID) error {
	found := r.reservations.InsertIfAbsent(instanceID, &Reservation{
		team:       team,
		instanceID: instanceID,
	})
	if found {
		return fmt.Errorf("reservation for instance %s already exists", instanceID)
	}

	return nil
}

func (r *ReservationCache) release(instanceID string) {
	r.reservations.Remove(instanceID)
}

func (r *ReservationCache) list(teamID uuid.UUID) (instanceIDs []string) {
	for _, item := range r.reservations.Items() {
		currentTeamID := item.team

		if currentTeamID == teamID {
			instanceIDs = append(instanceIDs, item.instanceID)
		}
	}

	return instanceIDs
}

func (c *InstanceCache) list(teamID uuid.UUID) (instanceIDs []string) {
	for _, item := range c.cache.Items() {
		value := item.Value()

		currentTeamID := value.TeamID

		if currentTeamID == nil {
			continue
		}

		if *currentTeamID == teamID {
			instanceIDs = append(instanceIDs, value.Instance.SandboxID)
		}
	}

	return instanceIDs
}

func (c *InstanceCache) Reserve(instanceID string, team uuid.UUID, limit int64) (error, func()) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Count unique IDs for team
	ids := map[string]struct{}{}

	for _, item := range c.reservations.list(team) {
		ids[item] = struct{}{}
	}

	for _, item := range c.list(team) {
		ids[item] = struct{}{}
	}

	reservedIDs := int64(len(ids))

	if reservedIDs >= limit {
		return fmt.Errorf("team %s has reached the limit of reserved instances", team), nil
	}

	err := c.reservations.reserve(instanceID, team)
	if err != nil {
		return fmt.Errorf("error when reserving instance: %w", err), nil
	}

	return nil, func() {
		// We will call this method with defer to ensure the reservation is released even if the function panics/returns an error.
		c.reservations.release(instanceID)
	}
}
