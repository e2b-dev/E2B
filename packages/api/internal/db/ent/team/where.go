// Code generated by ent, DO NOT EDIT.

package team

import (
	"time"

	"entgo.io/ent/dialect/sql"
	"entgo.io/ent/dialect/sql/sqlgraph"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/internal"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/predicate"
	"github.com/google/uuid"
)

// ID filters vertices based on their ID field.
func ID(id uuid.UUID) predicate.Team {
	return predicate.Team(sql.FieldEQ(FieldID, id))
}

// IDEQ applies the EQ predicate on the ID field.
func IDEQ(id uuid.UUID) predicate.Team {
	return predicate.Team(sql.FieldEQ(FieldID, id))
}

// IDNEQ applies the NEQ predicate on the ID field.
func IDNEQ(id uuid.UUID) predicate.Team {
	return predicate.Team(sql.FieldNEQ(FieldID, id))
}

// IDIn applies the In predicate on the ID field.
func IDIn(ids ...uuid.UUID) predicate.Team {
	return predicate.Team(sql.FieldIn(FieldID, ids...))
}

// IDNotIn applies the NotIn predicate on the ID field.
func IDNotIn(ids ...uuid.UUID) predicate.Team {
	return predicate.Team(sql.FieldNotIn(FieldID, ids...))
}

// IDGT applies the GT predicate on the ID field.
func IDGT(id uuid.UUID) predicate.Team {
	return predicate.Team(sql.FieldGT(FieldID, id))
}

// IDGTE applies the GTE predicate on the ID field.
func IDGTE(id uuid.UUID) predicate.Team {
	return predicate.Team(sql.FieldGTE(FieldID, id))
}

// IDLT applies the LT predicate on the ID field.
func IDLT(id uuid.UUID) predicate.Team {
	return predicate.Team(sql.FieldLT(FieldID, id))
}

// IDLTE applies the LTE predicate on the ID field.
func IDLTE(id uuid.UUID) predicate.Team {
	return predicate.Team(sql.FieldLTE(FieldID, id))
}

// CreatedAt applies equality check predicate on the "created_at" field. It's identical to CreatedAtEQ.
func CreatedAt(v time.Time) predicate.Team {
	return predicate.Team(sql.FieldEQ(FieldCreatedAt, v))
}

// IsDefault applies equality check predicate on the "is_default" field. It's identical to IsDefaultEQ.
func IsDefault(v bool) predicate.Team {
	return predicate.Team(sql.FieldEQ(FieldIsDefault, v))
}

// Name applies equality check predicate on the "name" field. It's identical to NameEQ.
func Name(v string) predicate.Team {
	return predicate.Team(sql.FieldEQ(FieldName, v))
}

// IsBlocked applies equality check predicate on the "is_blocked" field. It's identical to IsBlockedEQ.
func IsBlocked(v bool) predicate.Team {
	return predicate.Team(sql.FieldEQ(FieldIsBlocked, v))
}

// CreatedAtEQ applies the EQ predicate on the "created_at" field.
func CreatedAtEQ(v time.Time) predicate.Team {
	return predicate.Team(sql.FieldEQ(FieldCreatedAt, v))
}

// CreatedAtNEQ applies the NEQ predicate on the "created_at" field.
func CreatedAtNEQ(v time.Time) predicate.Team {
	return predicate.Team(sql.FieldNEQ(FieldCreatedAt, v))
}

// CreatedAtIn applies the In predicate on the "created_at" field.
func CreatedAtIn(vs ...time.Time) predicate.Team {
	return predicate.Team(sql.FieldIn(FieldCreatedAt, vs...))
}

// CreatedAtNotIn applies the NotIn predicate on the "created_at" field.
func CreatedAtNotIn(vs ...time.Time) predicate.Team {
	return predicate.Team(sql.FieldNotIn(FieldCreatedAt, vs...))
}

// CreatedAtGT applies the GT predicate on the "created_at" field.
func CreatedAtGT(v time.Time) predicate.Team {
	return predicate.Team(sql.FieldGT(FieldCreatedAt, v))
}

// CreatedAtGTE applies the GTE predicate on the "created_at" field.
func CreatedAtGTE(v time.Time) predicate.Team {
	return predicate.Team(sql.FieldGTE(FieldCreatedAt, v))
}

// CreatedAtLT applies the LT predicate on the "created_at" field.
func CreatedAtLT(v time.Time) predicate.Team {
	return predicate.Team(sql.FieldLT(FieldCreatedAt, v))
}

// CreatedAtLTE applies the LTE predicate on the "created_at" field.
func CreatedAtLTE(v time.Time) predicate.Team {
	return predicate.Team(sql.FieldLTE(FieldCreatedAt, v))
}

// IsDefaultEQ applies the EQ predicate on the "is_default" field.
func IsDefaultEQ(v bool) predicate.Team {
	return predicate.Team(sql.FieldEQ(FieldIsDefault, v))
}

// IsDefaultNEQ applies the NEQ predicate on the "is_default" field.
func IsDefaultNEQ(v bool) predicate.Team {
	return predicate.Team(sql.FieldNEQ(FieldIsDefault, v))
}

// NameEQ applies the EQ predicate on the "name" field.
func NameEQ(v string) predicate.Team {
	return predicate.Team(sql.FieldEQ(FieldName, v))
}

// NameNEQ applies the NEQ predicate on the "name" field.
func NameNEQ(v string) predicate.Team {
	return predicate.Team(sql.FieldNEQ(FieldName, v))
}

// NameIn applies the In predicate on the "name" field.
func NameIn(vs ...string) predicate.Team {
	return predicate.Team(sql.FieldIn(FieldName, vs...))
}

// NameNotIn applies the NotIn predicate on the "name" field.
func NameNotIn(vs ...string) predicate.Team {
	return predicate.Team(sql.FieldNotIn(FieldName, vs...))
}

// NameGT applies the GT predicate on the "name" field.
func NameGT(v string) predicate.Team {
	return predicate.Team(sql.FieldGT(FieldName, v))
}

// NameGTE applies the GTE predicate on the "name" field.
func NameGTE(v string) predicate.Team {
	return predicate.Team(sql.FieldGTE(FieldName, v))
}

// NameLT applies the LT predicate on the "name" field.
func NameLT(v string) predicate.Team {
	return predicate.Team(sql.FieldLT(FieldName, v))
}

// NameLTE applies the LTE predicate on the "name" field.
func NameLTE(v string) predicate.Team {
	return predicate.Team(sql.FieldLTE(FieldName, v))
}

// NameContains applies the Contains predicate on the "name" field.
func NameContains(v string) predicate.Team {
	return predicate.Team(sql.FieldContains(FieldName, v))
}

// NameHasPrefix applies the HasPrefix predicate on the "name" field.
func NameHasPrefix(v string) predicate.Team {
	return predicate.Team(sql.FieldHasPrefix(FieldName, v))
}

// NameHasSuffix applies the HasSuffix predicate on the "name" field.
func NameHasSuffix(v string) predicate.Team {
	return predicate.Team(sql.FieldHasSuffix(FieldName, v))
}

// NameEqualFold applies the EqualFold predicate on the "name" field.
func NameEqualFold(v string) predicate.Team {
	return predicate.Team(sql.FieldEqualFold(FieldName, v))
}

// NameContainsFold applies the ContainsFold predicate on the "name" field.
func NameContainsFold(v string) predicate.Team {
	return predicate.Team(sql.FieldContainsFold(FieldName, v))
}

// IsBlockedEQ applies the EQ predicate on the "is_blocked" field.
func IsBlockedEQ(v bool) predicate.Team {
	return predicate.Team(sql.FieldEQ(FieldIsBlocked, v))
}

// IsBlockedNEQ applies the NEQ predicate on the "is_blocked" field.
func IsBlockedNEQ(v bool) predicate.Team {
	return predicate.Team(sql.FieldNEQ(FieldIsBlocked, v))
}

// HasUsers applies the HasEdge predicate on the "users" edge.
func HasUsers() predicate.Team {
	return predicate.Team(func(s *sql.Selector) {
		step := sqlgraph.NewStep(
			sqlgraph.From(Table, FieldID),
			sqlgraph.Edge(sqlgraph.M2M, false, UsersTable, UsersPrimaryKey...),
		)
		schemaConfig := internal.SchemaConfigFromContext(s.Context())
		step.To.Schema = schemaConfig.User
		step.Edge.Schema = schemaConfig.UsersTeams
		sqlgraph.HasNeighbors(s, step)
	})
}

// HasUsersWith applies the HasEdge predicate on the "users" edge with a given conditions (other predicates).
func HasUsersWith(preds ...predicate.User) predicate.Team {
	return predicate.Team(func(s *sql.Selector) {
		step := newUsersStep()
		schemaConfig := internal.SchemaConfigFromContext(s.Context())
		step.To.Schema = schemaConfig.User
		step.Edge.Schema = schemaConfig.UsersTeams
		sqlgraph.HasNeighborsWith(s, step, func(s *sql.Selector) {
			for _, p := range preds {
				p(s)
			}
		})
	})
}

// HasTeamAPIKeys applies the HasEdge predicate on the "team_api_keys" edge.
func HasTeamAPIKeys() predicate.Team {
	return predicate.Team(func(s *sql.Selector) {
		step := sqlgraph.NewStep(
			sqlgraph.From(Table, FieldID),
			sqlgraph.Edge(sqlgraph.O2M, false, TeamAPIKeysTable, TeamAPIKeysColumn),
		)
		schemaConfig := internal.SchemaConfigFromContext(s.Context())
		step.To.Schema = schemaConfig.TeamApiKey
		step.Edge.Schema = schemaConfig.TeamApiKey
		sqlgraph.HasNeighbors(s, step)
	})
}

// HasTeamAPIKeysWith applies the HasEdge predicate on the "team_api_keys" edge with a given conditions (other predicates).
func HasTeamAPIKeysWith(preds ...predicate.TeamApiKey) predicate.Team {
	return predicate.Team(func(s *sql.Selector) {
		step := newTeamAPIKeysStep()
		schemaConfig := internal.SchemaConfigFromContext(s.Context())
		step.To.Schema = schemaConfig.TeamApiKey
		step.Edge.Schema = schemaConfig.TeamApiKey
		sqlgraph.HasNeighborsWith(s, step, func(s *sql.Selector) {
			for _, p := range preds {
				p(s)
			}
		})
	})
}

// HasUsersTeams applies the HasEdge predicate on the "users_teams" edge.
func HasUsersTeams() predicate.Team {
	return predicate.Team(func(s *sql.Selector) {
		step := sqlgraph.NewStep(
			sqlgraph.From(Table, FieldID),
			sqlgraph.Edge(sqlgraph.O2M, true, UsersTeamsTable, UsersTeamsColumn),
		)
		schemaConfig := internal.SchemaConfigFromContext(s.Context())
		step.To.Schema = schemaConfig.UsersTeams
		step.Edge.Schema = schemaConfig.UsersTeams
		sqlgraph.HasNeighbors(s, step)
	})
}

// HasUsersTeamsWith applies the HasEdge predicate on the "users_teams" edge with a given conditions (other predicates).
func HasUsersTeamsWith(preds ...predicate.UsersTeams) predicate.Team {
	return predicate.Team(func(s *sql.Selector) {
		step := newUsersTeamsStep()
		schemaConfig := internal.SchemaConfigFromContext(s.Context())
		step.To.Schema = schemaConfig.UsersTeams
		step.Edge.Schema = schemaConfig.UsersTeams
		sqlgraph.HasNeighborsWith(s, step, func(s *sql.Selector) {
			for _, p := range preds {
				p(s)
			}
		})
	})
}

// And groups predicates with the AND operator between them.
func And(predicates ...predicate.Team) predicate.Team {
	return predicate.Team(sql.AndPredicates(predicates...))
}

// Or groups predicates with the OR operator between them.
func Or(predicates ...predicate.Team) predicate.Team {
	return predicate.Team(sql.OrPredicates(predicates...))
}

// Not applies the not operator on the given predicate.
func Not(p predicate.Team) predicate.Team {
	return predicate.Team(sql.NotPredicates(p))
}