package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

type Tier struct {
	ent.Schema
}

func (Tier) Fields() []ent.Field {
	return []ent.Field{
		field.Text("id").Immutable().Unique(),
		field.Int8("vcpu"),
		field.Int8("ram_mb"),
		field.Int8("disk_mb"),
	}
}

func (Tier) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("teams", Team.Type),
	}
}
