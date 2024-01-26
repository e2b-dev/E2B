package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type Team struct {
	ent.Schema
}

func (Team) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Immutable().Unique().Annotations(entsql.Default("gen_random_uuid()")),
		field.Time("created_at").Immutable().Default(time.Now).Annotations(
			entsql.Default("CURRENT_TIMESTAMP"),
		),
		field.Bool("is_default"),
		field.Bool("is_banned").Annotations(entsql.Default("false")),
		field.Bool("is_blocked").Annotations(entsql.Default("false")),
		field.String("blocked_reason").Optional().Nillable().SchemaType(map[string]string{dialect.Postgres: "text"}),
		field.String("name").SchemaType(map[string]string{dialect.Postgres: "text"}),
		field.String("tier").SchemaType(map[string]string{dialect.Postgres: "text"}),
		field.String("email").MaxLen(255).SchemaType(map[string]string{dialect.Postgres: "character varying(255)"}),
	}
}

func (Team) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("users", User.Type).Through("users_teams", UsersTeams.Type).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.To("team_api_keys", TeamAPIKey.Type).Annotations(entsql.OnDelete(entsql.Cascade)),
		edge.From("team_tier", Tier.Type).Ref("teams").Unique().Field("tier").Required(),
		edge.To("envs", Env.Type),
	}
}

func (Team) Mixin() []ent.Mixin {
	return []ent.Mixin{
		Mixin{},
	}
}
