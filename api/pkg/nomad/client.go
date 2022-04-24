package nomad

import (
	"log"

	"github.com/hashicorp/nomad/api"
)

type Nomad struct {
	nomadClient *api.Client
}

const SessionJobID string = "vm-session"

func InitNomad() *Nomad {
	nomadConfig := api.Config{
		Address: "0.0.0.0",
	}

	nomad, err := api.NewClient(&nomadConfig)

	if err != nil {
		log.Fatalf("Error determining current working dir\n> %s\n", err)
	}

	return &Nomad{
		nomadClient: nomad,
	}
}
