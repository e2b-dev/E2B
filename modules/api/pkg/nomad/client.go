package nomad

import (
	"log"
	"os"

	"github.com/hashicorp/nomad/api"
)

type Nomad struct {
	nomadClient *api.Client
}

func InitNomad() *Nomad {
	nomadConfig := api.Config{
		Address: os.Getenv("NOMAD_ADDRESS"),
	}

	nomad, err := api.NewClient(&nomadConfig)

	if err != nil {
		log.Fatalf("Error determining current working dir\n> %s\n", err)
	}

	return &Nomad{
		nomadClient: nomad,
	}
}
