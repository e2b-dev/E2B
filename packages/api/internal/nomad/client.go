package nomad

import (
	"context"
	"log"
	"os"

	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"go.uber.org/zap"

	"github.com/hashicorp/nomad/api"
)

var (
	nomadAddress = os.Getenv("NOMAD_ADDRESS")
	nomadToken   = os.Getenv("NOMAD_TOKEN")
)

type NomadClient struct {
	client      *api.Client
	logger      *zap.SugaredLogger
	subscribers *utils.Map[*jobSubscriber]
	cancel      context.CancelFunc
}

func InitNomadClient(logger *zap.SugaredLogger) *NomadClient {
	client, err := api.NewClient(&api.Config{
		Address:  nomadAddress,
		SecretID: nomadToken,
	})
	if err != nil {
		log.Fatalf("Error determining current working dir\n> %s\n", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	n := &NomadClient{
		client:      client,
		logger:      logger,
		subscribers: utils.NewMap[*jobSubscriber](),
		cancel:      cancel,
	}

	go n.ListenToJobs(ctx)

	return n
}

func (n *NomadClient) Close() {
	n.client.Close()
	n.cancel()
}
