package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect"
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
		field.String("id").Unique().StorageKey("alias").Immutable().SchemaType(map[string]string{dialect.Postgres: "text"}),
		field.String("env_id").Nillable().Optional().SchemaType(map[string]string{dialect.Postgres: "text"}),
		field.Bool("is_name").Default(true),
	}
}

func (EnvAlias) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("env", Env.Type).Ref("env_aliases").Unique().Field("env_id"),
	}
}

func (EnvAlias) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Annotation{Table: "env_aliases"},
	}
}

func (EnvAlias) Mixin() []ent.Mixin {
	return []ent.Mixin{
		Mixin{},
	}
}
