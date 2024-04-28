package instance

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	"github.com/e2b-dev/infra/packages/shared/pkg/env"
)

func (c *InstanceCache) UpdateCounter(instance InstanceInfo, value int64) {
	attributes := []attribute.KeyValue{
		attribute.String("env_id", instance.Instance.TemplateID),
		attribute.String("team_id", instance.TeamID.String()),
	}

	if env.IsProduction() {
		attributes = append(attributes, attribute.String("instance_id", instance.Instance.SandboxID))
	}

	c.counter.Add(context.Background(), value, metric.WithAttributes(attributes...))
}
