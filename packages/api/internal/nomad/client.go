package nomad

import (
	"context"
	"log"
	"os"

	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"github.com/hashicorp/nomad/api"
)

var (
	nomadAddress = os.Getenv("NOMAD_ADDRESS")
	nomadToken   = os.Getenv("NOMAD_TOKEN")
)

type NomadClient struct {
	client      *api.Client
	subscribers *utils.Map[*JobSubscriber]
	cancel      context.CancelFunc
}

func InitNomadClient() *NomadClient {
	config := api.Config{
		Address:  nomadAddress,
		SecretID: nomadToken,
	}

	client, err := api.NewClient(&config)
	if err != nil {
		log.Fatalf("Error determining current working dir\n> %s\n", err)
	}

	listenCtx, cancel := context.WithCancel(context.Background())

	n := &NomadClient{
		client:      client,
		subscribers: utils.NewMap[*JobSubscriber](),
		cancel:      cancel,
	}

	go n.ListenToJobs(listenCtx)

	return n
}

func (n *NomadClient) Close() {
	n.client.Close()
	n.cancel()
}
