package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

type EnvAlias struct {
	ent.Schema
}

func (EnvAlias) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").Unique().StorageKey("alias").Immutable(),
		field.String("env_id").Nillable().Optional(),
		field.Bool("is_name"),
	}
}

func (EnvAlias) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("alias_env", Env.Type).Ref("env_aliases").Unique().Field("env_id"),
	}
}

func (EnvAlias) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "env_aliases"},
	}
}
