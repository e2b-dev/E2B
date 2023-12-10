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
		field.String("id").Unique().StorageKey("access_token").Immutable(),
		field.UUID("user_id", uuid.UUID{}),
		field.Time("created_at").Immutable().Annotations(
			entsql.Default("CURRENT_TIMESTAMP"),
		),
	}
}

func (AccessToken) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("access_tokens").Unique().Field("user_id").Required(),
	}
}

func (AccessToken) Mixin() []ent.Mixin {
	return []ent.Mixin{
		Mixin{},
	}
}
