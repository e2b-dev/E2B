package nomad

import (
	"log"
	"os"

	"github.com/hashicorp/nomad/api"
)

type NomadClient struct {
	client *api.Client
}

func InitNomadClient() *NomadClient {
	config := api.Config{
		Address: os.Getenv("NOMAD_ADDRESS"),
	}

	client, err := api.NewClient(&config)
	if err != nil {
		log.Fatalf("Error determining current working dir\n> %s\n", err)
	}

	return &NomadClient{
		client: client,
	}
}

func (nc *NomadClient) Close() {
	nc.client.Close()
}
