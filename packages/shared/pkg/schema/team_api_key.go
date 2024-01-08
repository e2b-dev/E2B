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

type TeamAPIKey struct {
	ent.Schema
}

func (TeamAPIKey) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").Unique().StorageKey("api_key").Sensitive().SchemaType(map[string]string{dialect.Postgres: "character varying(44)"}),
		field.Time("created_at").Immutable().Default(time.Now).Annotations(
			entsql.Default("CURRENT_TIMESTAMP"),
		),
		field.UUID("team_id", uuid.UUID{}),
	}
}

func (TeamAPIKey) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("team", Team.Type).Unique().Required().
			Ref("team_api_keys").
			Field("team_id"),
	}
}

func (TeamAPIKey) Annotations() []schema.Annotation {
	return nil
}

func (TeamAPIKey) Mixin() []ent.Mixin {
	return []ent.Mixin{
		Mixin{},
	}
}
