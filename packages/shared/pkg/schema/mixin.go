package schema

import (
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/mixin"
)

// Mixin holds the default configuration for most schemas in this package.
type Mixin struct {
	mixin.Schema
}

// Annotations of the Mixin.
func (Mixin) Annotations() []schema.Annotation {
	return []schema.Annotation{
		entsql.Schema("public"),
	}
}
