package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

type Team struct {
	ent.Schema
}

func (Team) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Immutable(),
		field.Time("created_at").Immutable(),
		field.Bool("is_default"),
		field.String("name"),
		field.Bool("is_blocked"),
	}
}
func (Team) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("users", User.Type).Through("users_teams", UsersTeams.Type),
	}
}
