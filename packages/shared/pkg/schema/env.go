package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type Env struct {
	ent.Schema
}

func (Env) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").Unique().Immutable().SchemaType(map[string]string{dialect.Postgres: "text"}),
		field.Time("created_at").Immutable().Default(time.Now).
			Annotations(
				entsql.Default("CURRENT_TIMESTAMP"),
			),
		field.Time("updated_at").Default(time.Now),
		field.UUID("team_id", uuid.UUID{}),
		field.Bool("public").Annotations(entsql.Default("false")),
		field.Int32("build_count").Default(1),
		field.Int64("spawn_count").Default(0).Comment("Number of times the env was spawned"),
		field.Time("last_spawned_at").Optional().Comment("Timestamp of the last time the env was spawned"),
	}
}

func (Env) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("team", Team.Type).Ref("envs").Unique().Field("team_id").Required(),
		edge.To("env_aliases", EnvAlias.Type).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("builds", EnvBuild.Type).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Env) Annotations() []schema.Annotation {
	withComments := true

	return []schema.Annotation{
		entsql.Annotation{WithComments: &withComments},
	}
}

func (Env) Mixin() []ent.Mixin {
	return []ent.Mixin{
		Mixin{},
	}
}
