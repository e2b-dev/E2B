package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
	"time"
)

type Env struct {
	ent.Schema
}

func (Env) Fields() []ent.Field {
	return []ent.Field{
		field.String("id").Immutable(),
		field.Time("created_at").Immutable().Default(time.Now).
			Annotations(
				entsql.Default("CURRENT_TIMESTAMP"),
			),
		field.UUID("team_id", uuid.UUID{}),
		field.String("dockerfile"),
		field.Bool("public"),
		field.UUID("build_id", uuid.UUID{}),
	}
}
func (Env) Edges() []ent.Edge {
	return []ent.Edge{edge.To("team", Team.Type)}
}
func (Env) Annotations() []schema.Annotation {
	return nil
}
