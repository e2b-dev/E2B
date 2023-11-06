package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

type EnvAlias struct {
	ent.Schema
}

func (EnvAlias) Fields() []ent.Field {
	return []ent.Field{
		field.Text("alias").Immutable().Unique(),
		field.String("env_id"),
	}
}

func (EnvAlias) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("alias_env", Env.Type).Ref("env_aliases").Unique().Field("env_id").Required(),
	}
}
