package schema

import (
	"time"

	"entgo.io/ent"
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
		field.String("id").Unique().Immutable(),
		field.Time("created_at").Immutable().Default(time.Now).
			Annotations(
				entsql.Default("CURRENT_TIMESTAMP"),
			),
		field.Time("updated_at").Default(time.Now),
		field.UUID("team_id", uuid.UUID{}),
		field.String("dockerfile"),
		field.Bool("public"),
		field.UUID("build_id", uuid.UUID{}),
		field.Int32("build_count").Default(1),
		field.Int32("spawn_count").Default(0),
		field.Time("last_spawned_at").Optional(),
		field.Int64("vcpu"),
		field.Int64("ram_mb"),
		field.Int64("free_disk_size_mb"),
		field.Int64("total_disk_size_mb"),
	}
}

func (Env) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("team", Team.Type).Ref("envs").Unique().Field("team_id").Required(),
		edge.To("env_aliases", EnvAlias.Type).Annotations(entsql.OnDelete(entsql.Cascade)),
	}
}

func (Env) Annotations() []schema.Annotation {
	return nil
}

func (Env) Mixin() []ent.Mixin {
	return []ent.Mixin{
		Mixin{},
	}
}
