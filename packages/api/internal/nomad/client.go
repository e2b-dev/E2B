package nomad

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/e2b-dev/infra/packages/api/internal/nomad/cache/instance"
	"github.com/e2b-dev/infra/packages/api/internal/utils"
	"go.uber.org/zap"

	"github.com/hashicorp/nomad/api"
)

const streamRetryTime = 10 * time.Millisecond

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

	index, err := n.GetStartingIndex(ctx)
	if err != nil {
		log.Fatal(err)
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
				listenErr := n.ListenToJobs(ctx, index)
				if listenErr != nil {
					fmt.Fprintf(os.Stderr, "Error listening to Nomad jobs\n> %v\n", listenErr)

					time.Sleep(streamRetryTime)

					continue
				}

				return
			}
		}
	}()

	return n
}

func (n *NomadClient) Close() {
	n.client.Close()
	n.cancel()
}

// Sync the cache with the actual instances in Nomad to handle instances that died.
func (n *NomadClient) KeepInSync(instanceCache *instance.InstanceCache) {
	for {
		time.Sleep(instance.CacheSyncTime)

		activeInstances, err := n.GetInstances()
		if err != nil {
			n.logger.Errorf("Error loading current instances from Nomad\n: %v", err.Err)
		} else {
			instanceCache.Sync(activeInstances)
		}
	}
}
