package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type AccessToken struct {
	ent.Schema
}

func (AccessToken) Fields() []ent.Field {
	return []ent.Field{
		field.String("access_token").Unique().Immutable(),
		field.UUID("user_id", uuid.UUID{}),
		field.Time("created_at").Immutable().Annotations(
			entsql.Default("CURRENT_TIMESTAMP"),
		),
	}
}
func (AccessToken) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("users", User.Type),
	}
}
