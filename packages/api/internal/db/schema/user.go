package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"github.com/google/uuid"
)

// User holds the schema definition for the User entity.
type User struct {
	ent.Schema
}

// Fields of the User.
func (User) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Immutable(),
		field.String("email"),
	}
}

func (User) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("teams", Team.Type).Through("users_teams", UsersTeams.Type).Ref("users"),
	}
}
