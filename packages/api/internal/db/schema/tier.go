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
		field.String("id").Immutable().Unique(),
		field.Int64("vcpu"),
		field.Int64("ram_mb"),
		field.Int64("disk_mb"),
		field.Int64("concurrent_instances"),
	}
}

func (Tier) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("teams", Team.Type),
	}
}
