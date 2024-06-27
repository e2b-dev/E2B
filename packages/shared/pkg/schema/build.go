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

const (
	DefaultKernelVersion = "vmlinux-5.10.186"
	// The Firecracker version the last tag + the short SHA (so we can build our dev previews)
	DefaultFirecrackerVersion = "v1.7.0-dev_8bb88311"
)

type EnvBuild struct {
	ent.Schema
}

func (EnvBuild) Fields() []ent.Field {
	return []ent.Field{
		field.UUID("id", uuid.UUID{}).Immutable().Unique().Annotations(entsql.Default("gen_random_uuid()")),
		field.Time("created_at").Immutable().Default(time.Now).
			Annotations(
				entsql.Default("CURRENT_TIMESTAMP"),
			),
		field.Time("updated_at").Default(time.Now),
		field.Time("finished_at").Optional().Nillable(),
		field.String("env_id").SchemaType(map[string]string{dialect.Postgres: "text"}).Optional().Nillable(),
		field.Enum("status").Values("waiting", "building", "failed", "success").Default("waiting").SchemaType(map[string]string{dialect.Postgres: "text"}),
		field.String("dockerfile").SchemaType(map[string]string{dialect.Postgres: "text"}).Optional().Nillable(),
		field.String("start_cmd").SchemaType(map[string]string{dialect.Postgres: "text"}).Optional().Nillable(),
		field.Int64("vcpu"),
		field.Int64("ram_mb"),
		field.Int64("free_disk_size_mb"),
		field.Int64("total_disk_size_mb").Optional().Nillable(),
		field.String("kernel_version").Default(DefaultKernelVersion).SchemaType(map[string]string{dialect.Postgres: "text"}),
		field.String("firecracker_version").Default(DefaultFirecrackerVersion).SchemaType(map[string]string{dialect.Postgres: "text"}),
		field.String("envd_version").SchemaType(map[string]string{dialect.Postgres: "text"}).Nillable().Optional(),
	}
}

func (EnvBuild) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("env", Env.Type).Ref("builds").Unique().Field("env_id"),
	}
}

func (EnvBuild) Mixin() []ent.Mixin {
	return []ent.Mixin{
		Mixin{},
	}
}
