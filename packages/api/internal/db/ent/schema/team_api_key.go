package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type TeamApiKey struct {
	ent.Schema
}

func (TeamApiKey) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").StorageKey("api_key"),
		field.Time("created_at"),
		field.UUID("team_id", uuid.UUID{}),
	}
}
func (TeamApiKey) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("team", Team.Type),
	}
}
func (TeamApiKey) Annotations() []schema.Annotation {
	return nil
}
