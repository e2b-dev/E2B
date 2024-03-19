package instance

import (
	"fmt"
	"os"
	"sync"

	"github.com/e2b-dev/infra/packages/shared/pkg/smap"
	"github.com/google/uuid"
)

type TeamReservations struct {
	mu    sync.RWMutex
	count int64
}

type ReservationCache struct {
	reservations *smap.Map[*TeamReservations]
}

func NewReservationCache() *ReservationCache {
	return &ReservationCache{
		reservations: smap.New[*TeamReservations](),
	}
}

func (r *ReservationCache) reserve(teamID uuid.UUID, limit int64) error {
	reservation, found := r.reservations.Get(teamID.String())
	if !found {
		reservation = &TeamReservations{}
		inserted := r.reservations.InsertIfAbsent(teamID.String(), reservation)

		if !inserted {
			fmt.Fprintf(os.Stderr, "reservation for team %s already exists, skipping insertion", teamID)
		}
	}

	reservation.mu.Lock()
	defer reservation.mu.Unlock()

	if reservation.count >= limit {
		return fmt.Errorf("team %s reached the limit of reservations", teamID)
	}

	reservation.count++

	return nil
}

func (r *ReservationCache) release(teamID uuid.UUID) error {
	reservation, found := r.reservations.Get(teamID.String())
	if !found {
		return fmt.Errorf("reservation for team %s not found", teamID)
	}

	reservation.mu.Lock()
	defer reservation.mu.Unlock()

	if reservation.count == 0 {
		return fmt.Errorf("all reservations for team %s already released", teamID)
	}

	reservation.count--

	return nil
}

func (r *ReservationCache) count(teamID *uuid.UUID) int64 {
	reservation, found := r.reservations.Get(teamID.String())
	if !found {
		return 0
	}

	reservation.mu.RLock()
	defer reservation.mu.RUnlock()

	return reservation.count
}

func (c *InstanceCache) Reserve(team uuid.UUID, limit int64) (error, func() error) {
	err := c.reservations.reserve(team, limit-int64(c.CountForTeam(team)))
	if err != nil {
		return fmt.Errorf("error when reserving instance: %w", err), nil
	}

	return nil, func() error {
		return c.reservations.release(team)
	}
}
