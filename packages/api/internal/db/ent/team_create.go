// Code generated by ent, DO NOT EDIT.

package ent

import (
	"context"
	"errors"
	"fmt"
	"time"

	"entgo.io/ent/dialect"
	"entgo.io/ent/dialect/sql"
	"entgo.io/ent/dialect/sql/sqlgraph"
	"entgo.io/ent/schema/field"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/env"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/team"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/teamapikey"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/tier"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/user"
	"github.com/e2b-dev/infra/packages/api/internal/db/ent/usersteams"
	"github.com/google/uuid"
)

// TeamCreate is the builder for creating a Team entity.
type TeamCreate struct {
	config
	mutation *TeamMutation
	hooks    []Hook
	conflict []sql.ConflictOption
}

// SetCreatedAt sets the "created_at" field.
func (tc *TeamCreate) SetCreatedAt(t time.Time) *TeamCreate {
	tc.mutation.SetCreatedAt(t)
	return tc
}

// SetNillableCreatedAt sets the "created_at" field if the given value is not nil.
func (tc *TeamCreate) SetNillableCreatedAt(t *time.Time) *TeamCreate {
	if t != nil {
		tc.SetCreatedAt(*t)
	}
	return tc
}

// SetIsDefault sets the "is_default" field.
func (tc *TeamCreate) SetIsDefault(b bool) *TeamCreate {
	tc.mutation.SetIsDefault(b)
	return tc
}

// SetName sets the "name" field.
func (tc *TeamCreate) SetName(s string) *TeamCreate {
	tc.mutation.SetName(s)
	return tc
}

// SetTier sets the "tier" field.
func (tc *TeamCreate) SetTier(s string) *TeamCreate {
	tc.mutation.SetTier(s)
	return tc
}

// SetIsBlocked sets the "is_blocked" field.
func (tc *TeamCreate) SetIsBlocked(b bool) *TeamCreate {
	tc.mutation.SetIsBlocked(b)
	return tc
}

// SetID sets the "id" field.
func (tc *TeamCreate) SetID(u uuid.UUID) *TeamCreate {
	tc.mutation.SetID(u)
	return tc
}

// AddUserIDs adds the "users" edge to the User entity by IDs.
func (tc *TeamCreate) AddUserIDs(ids ...uuid.UUID) *TeamCreate {
	tc.mutation.AddUserIDs(ids...)
	return tc
}

// AddUsers adds the "users" edges to the User entity.
func (tc *TeamCreate) AddUsers(u ...*User) *TeamCreate {
	ids := make([]uuid.UUID, len(u))
	for i := range u {
		ids[i] = u[i].ID
	}
	return tc.AddUserIDs(ids...)
}

// AddTeamAPIKeyIDs adds the "team_api_keys" edge to the TeamApiKey entity by IDs.
func (tc *TeamCreate) AddTeamAPIKeyIDs(ids ...string) *TeamCreate {
	tc.mutation.AddTeamAPIKeyIDs(ids...)
	return tc
}

// AddTeamAPIKeys adds the "team_api_keys" edges to the TeamApiKey entity.
func (tc *TeamCreate) AddTeamAPIKeys(t ...*TeamApiKey) *TeamCreate {
	ids := make([]string, len(t))
	for i := range t {
		ids[i] = t[i].ID
	}
	return tc.AddTeamAPIKeyIDs(ids...)
}

// SetTeamTierID sets the "team_tier" edge to the Tier entity by ID.
func (tc *TeamCreate) SetTeamTierID(id string) *TeamCreate {
	tc.mutation.SetTeamTierID(id)
	return tc
}

// SetTeamTier sets the "team_tier" edge to the Tier entity.
func (tc *TeamCreate) SetTeamTier(t *Tier) *TeamCreate {
	return tc.SetTeamTierID(t.ID)
}

// AddEnvIDs adds the "envs" edge to the Env entity by IDs.
func (tc *TeamCreate) AddEnvIDs(ids ...string) *TeamCreate {
	tc.mutation.AddEnvIDs(ids...)
	return tc
}

// AddEnvs adds the "envs" edges to the Env entity.
func (tc *TeamCreate) AddEnvs(e ...*Env) *TeamCreate {
	ids := make([]string, len(e))
	for i := range e {
		ids[i] = e[i].ID
	}
	return tc.AddEnvIDs(ids...)
}

// AddUsersTeamIDs adds the "users_teams" edge to the UsersTeams entity by IDs.
func (tc *TeamCreate) AddUsersTeamIDs(ids ...int) *TeamCreate {
	tc.mutation.AddUsersTeamIDs(ids...)
	return tc
}

// AddUsersTeams adds the "users_teams" edges to the UsersTeams entity.
func (tc *TeamCreate) AddUsersTeams(u ...*UsersTeams) *TeamCreate {
	ids := make([]int, len(u))
	for i := range u {
		ids[i] = u[i].ID
	}
	return tc.AddUsersTeamIDs(ids...)
}

// Mutation returns the TeamMutation object of the builder.
func (tc *TeamCreate) Mutation() *TeamMutation {
	return tc.mutation
}

// Save creates the Team in the database.
func (tc *TeamCreate) Save(ctx context.Context) (*Team, error) {
	tc.defaults()
	return withHooks(ctx, tc.sqlSave, tc.mutation, tc.hooks)
}

// SaveX calls Save and panics if Save returns an error.
func (tc *TeamCreate) SaveX(ctx context.Context) *Team {
	v, err := tc.Save(ctx)
	if err != nil {
		panic(err)
	}
	return v
}

// Exec executes the query.
func (tc *TeamCreate) Exec(ctx context.Context) error {
	_, err := tc.Save(ctx)
	return err
}

// ExecX is like Exec, but panics if an error occurs.
func (tc *TeamCreate) ExecX(ctx context.Context) {
	if err := tc.Exec(ctx); err != nil {
		panic(err)
	}
}

// defaults sets the default values of the builder before save.
func (tc *TeamCreate) defaults() {
	if _, ok := tc.mutation.CreatedAt(); !ok {
		v := team.DefaultCreatedAt()
		tc.mutation.SetCreatedAt(v)
	}
}

// check runs all checks and user-defined validators on the builder.
func (tc *TeamCreate) check() error {
	if _, ok := tc.mutation.CreatedAt(); !ok {
		return &ValidationError{Name: "created_at", err: errors.New(`ent: missing required field "Team.created_at"`)}
	}
	if _, ok := tc.mutation.IsDefault(); !ok {
		return &ValidationError{Name: "is_default", err: errors.New(`ent: missing required field "Team.is_default"`)}
	}
	if _, ok := tc.mutation.Name(); !ok {
		return &ValidationError{Name: "name", err: errors.New(`ent: missing required field "Team.name"`)}
	}
	if _, ok := tc.mutation.Tier(); !ok {
		return &ValidationError{Name: "tier", err: errors.New(`ent: missing required field "Team.tier"`)}
	}
	if _, ok := tc.mutation.IsBlocked(); !ok {
		return &ValidationError{Name: "is_blocked", err: errors.New(`ent: missing required field "Team.is_blocked"`)}
	}
	if _, ok := tc.mutation.TeamTierID(); !ok {
		return &ValidationError{Name: "team_tier", err: errors.New(`ent: missing required edge "Team.team_tier"`)}
	}
	return nil
}

func (tc *TeamCreate) sqlSave(ctx context.Context) (*Team, error) {
	if err := tc.check(); err != nil {
		return nil, err
	}
	_node, _spec := tc.createSpec()
	if err := sqlgraph.CreateNode(ctx, tc.driver, _spec); err != nil {
		if sqlgraph.IsConstraintError(err) {
			err = &ConstraintError{msg: err.Error(), wrap: err}
		}
		return nil, err
	}
	if _spec.ID.Value != nil {
		if id, ok := _spec.ID.Value.(*uuid.UUID); ok {
			_node.ID = *id
		} else if err := _node.ID.Scan(_spec.ID.Value); err != nil {
			return nil, err
		}
	}
	tc.mutation.id = &_node.ID
	tc.mutation.done = true
	return _node, nil
}

func (tc *TeamCreate) createSpec() (*Team, *sqlgraph.CreateSpec) {
	var (
		_node = &Team{config: tc.config}
		_spec = sqlgraph.NewCreateSpec(team.Table, sqlgraph.NewFieldSpec(team.FieldID, field.TypeUUID))
	)
	_spec.Schema = tc.schemaConfig.Team
	_spec.OnConflict = tc.conflict
	if id, ok := tc.mutation.ID(); ok {
		_node.ID = id
		_spec.ID.Value = &id
	}
	if value, ok := tc.mutation.CreatedAt(); ok {
		_spec.SetField(team.FieldCreatedAt, field.TypeTime, value)
		_node.CreatedAt = value
	}
	if value, ok := tc.mutation.IsDefault(); ok {
		_spec.SetField(team.FieldIsDefault, field.TypeBool, value)
		_node.IsDefault = value
	}
	if value, ok := tc.mutation.Name(); ok {
		_spec.SetField(team.FieldName, field.TypeString, value)
		_node.Name = value
	}
	if value, ok := tc.mutation.IsBlocked(); ok {
		_spec.SetField(team.FieldIsBlocked, field.TypeBool, value)
		_node.IsBlocked = value
	}
	if nodes := tc.mutation.UsersIDs(); len(nodes) > 0 {
		edge := &sqlgraph.EdgeSpec{
			Rel:     sqlgraph.M2M,
			Inverse: false,
			Table:   team.UsersTable,
			Columns: team.UsersPrimaryKey,
			Bidi:    false,
			Target: &sqlgraph.EdgeTarget{
				IDSpec: sqlgraph.NewFieldSpec(user.FieldID, field.TypeUUID),
			},
		}
		edge.Schema = tc.schemaConfig.UsersTeams
		for _, k := range nodes {
			edge.Target.Nodes = append(edge.Target.Nodes, k)
		}
		_spec.Edges = append(_spec.Edges, edge)
	}
	if nodes := tc.mutation.TeamAPIKeysIDs(); len(nodes) > 0 {
		edge := &sqlgraph.EdgeSpec{
			Rel:     sqlgraph.O2M,
			Inverse: false,
			Table:   team.TeamAPIKeysTable,
			Columns: []string{team.TeamAPIKeysColumn},
			Bidi:    false,
			Target: &sqlgraph.EdgeTarget{
				IDSpec: sqlgraph.NewFieldSpec(teamapikey.FieldID, field.TypeString),
			},
		}
		edge.Schema = tc.schemaConfig.TeamApiKey
		for _, k := range nodes {
			edge.Target.Nodes = append(edge.Target.Nodes, k)
		}
		_spec.Edges = append(_spec.Edges, edge)
	}
	if nodes := tc.mutation.TeamTierIDs(); len(nodes) > 0 {
		edge := &sqlgraph.EdgeSpec{
			Rel:     sqlgraph.M2O,
			Inverse: true,
			Table:   team.TeamTierTable,
			Columns: []string{team.TeamTierColumn},
			Bidi:    false,
			Target: &sqlgraph.EdgeTarget{
				IDSpec: sqlgraph.NewFieldSpec(tier.FieldID, field.TypeString),
			},
		}
		edge.Schema = tc.schemaConfig.Team
		for _, k := range nodes {
			edge.Target.Nodes = append(edge.Target.Nodes, k)
		}
		_node.Tier = nodes[0]
		_spec.Edges = append(_spec.Edges, edge)
	}
	if nodes := tc.mutation.EnvsIDs(); len(nodes) > 0 {
		edge := &sqlgraph.EdgeSpec{
			Rel:     sqlgraph.O2M,
			Inverse: false,
			Table:   team.EnvsTable,
			Columns: []string{team.EnvsColumn},
			Bidi:    false,
			Target: &sqlgraph.EdgeTarget{
				IDSpec: sqlgraph.NewFieldSpec(env.FieldID, field.TypeString),
			},
		}
		edge.Schema = tc.schemaConfig.Env
		for _, k := range nodes {
			edge.Target.Nodes = append(edge.Target.Nodes, k)
		}
		_spec.Edges = append(_spec.Edges, edge)
	}
	if nodes := tc.mutation.UsersTeamsIDs(); len(nodes) > 0 {
		edge := &sqlgraph.EdgeSpec{
			Rel:     sqlgraph.O2M,
			Inverse: true,
			Table:   team.UsersTeamsTable,
			Columns: []string{team.UsersTeamsColumn},
			Bidi:    false,
			Target: &sqlgraph.EdgeTarget{
				IDSpec: sqlgraph.NewFieldSpec(usersteams.FieldID, field.TypeInt),
			},
		}
		edge.Schema = tc.schemaConfig.UsersTeams
		for _, k := range nodes {
			edge.Target.Nodes = append(edge.Target.Nodes, k)
		}
		_spec.Edges = append(_spec.Edges, edge)
	}
	return _node, _spec
}

// OnConflict allows configuring the `ON CONFLICT` / `ON DUPLICATE KEY` clause
// of the `INSERT` statement. For example:
//
//	client.Team.Create().
//		SetCreatedAt(v).
//		OnConflict(
//			// Update the row with the new values
//			// the was proposed for insertion.
//			sql.ResolveWithNewValues(),
//		).
//		// Override some of the fields with custom
//		// update values.
//		Update(func(u *ent.TeamUpsert) {
//			SetCreatedAt(v+v).
//		}).
//		Exec(ctx)
func (tc *TeamCreate) OnConflict(opts ...sql.ConflictOption) *TeamUpsertOne {
	tc.conflict = opts
	return &TeamUpsertOne{
		create: tc,
	}
}

// OnConflictColumns calls `OnConflict` and configures the columns
// as conflict target. Using this option is equivalent to using:
//
//	client.Team.Create().
//		OnConflict(sql.ConflictColumns(columns...)).
//		Exec(ctx)
func (tc *TeamCreate) OnConflictColumns(columns ...string) *TeamUpsertOne {
	tc.conflict = append(tc.conflict, sql.ConflictColumns(columns...))
	return &TeamUpsertOne{
		create: tc,
	}
}

type (
	// TeamUpsertOne is the builder for "upsert"-ing
	//  one Team node.
	TeamUpsertOne struct {
		create *TeamCreate
	}

	// TeamUpsert is the "OnConflict" setter.
	TeamUpsert struct {
		*sql.UpdateSet
	}
)

// SetIsDefault sets the "is_default" field.
func (u *TeamUpsert) SetIsDefault(v bool) *TeamUpsert {
	u.Set(team.FieldIsDefault, v)
	return u
}

// UpdateIsDefault sets the "is_default" field to the value that was provided on create.
func (u *TeamUpsert) UpdateIsDefault() *TeamUpsert {
	u.SetExcluded(team.FieldIsDefault)
	return u
}

// SetName sets the "name" field.
func (u *TeamUpsert) SetName(v string) *TeamUpsert {
	u.Set(team.FieldName, v)
	return u
}

// UpdateName sets the "name" field to the value that was provided on create.
func (u *TeamUpsert) UpdateName() *TeamUpsert {
	u.SetExcluded(team.FieldName)
	return u
}

// SetTier sets the "tier" field.
func (u *TeamUpsert) SetTier(v string) *TeamUpsert {
	u.Set(team.FieldTier, v)
	return u
}

// UpdateTier sets the "tier" field to the value that was provided on create.
func (u *TeamUpsert) UpdateTier() *TeamUpsert {
	u.SetExcluded(team.FieldTier)
	return u
}

// SetIsBlocked sets the "is_blocked" field.
func (u *TeamUpsert) SetIsBlocked(v bool) *TeamUpsert {
	u.Set(team.FieldIsBlocked, v)
	return u
}

// UpdateIsBlocked sets the "is_blocked" field to the value that was provided on create.
func (u *TeamUpsert) UpdateIsBlocked() *TeamUpsert {
	u.SetExcluded(team.FieldIsBlocked)
	return u
}

// UpdateNewValues updates the mutable fields using the new values that were set on create except the ID field.
// Using this option is equivalent to using:
//
//	client.Team.Create().
//		OnConflict(
//			sql.ResolveWithNewValues(),
//			sql.ResolveWith(func(u *sql.UpdateSet) {
//				u.SetIgnore(team.FieldID)
//			}),
//		).
//		Exec(ctx)
func (u *TeamUpsertOne) UpdateNewValues() *TeamUpsertOne {
	u.create.conflict = append(u.create.conflict, sql.ResolveWithNewValues())
	u.create.conflict = append(u.create.conflict, sql.ResolveWith(func(s *sql.UpdateSet) {
		if _, exists := u.create.mutation.ID(); exists {
			s.SetIgnore(team.FieldID)
		}
		if _, exists := u.create.mutation.CreatedAt(); exists {
			s.SetIgnore(team.FieldCreatedAt)
		}
	}))
	return u
}

// Ignore sets each column to itself in case of conflict.
// Using this option is equivalent to using:
//
//	client.Team.Create().
//	    OnConflict(sql.ResolveWithIgnore()).
//	    Exec(ctx)
func (u *TeamUpsertOne) Ignore() *TeamUpsertOne {
	u.create.conflict = append(u.create.conflict, sql.ResolveWithIgnore())
	return u
}

// DoNothing configures the conflict_action to `DO NOTHING`.
// Supported only by SQLite and PostgreSQL.
func (u *TeamUpsertOne) DoNothing() *TeamUpsertOne {
	u.create.conflict = append(u.create.conflict, sql.DoNothing())
	return u
}

// Update allows overriding fields `UPDATE` values. See the TeamCreate.OnConflict
// documentation for more info.
func (u *TeamUpsertOne) Update(set func(*TeamUpsert)) *TeamUpsertOne {
	u.create.conflict = append(u.create.conflict, sql.ResolveWith(func(update *sql.UpdateSet) {
		set(&TeamUpsert{UpdateSet: update})
	}))
	return u
}

// SetIsDefault sets the "is_default" field.
func (u *TeamUpsertOne) SetIsDefault(v bool) *TeamUpsertOne {
	return u.Update(func(s *TeamUpsert) {
		s.SetIsDefault(v)
	})
}

// UpdateIsDefault sets the "is_default" field to the value that was provided on create.
func (u *TeamUpsertOne) UpdateIsDefault() *TeamUpsertOne {
	return u.Update(func(s *TeamUpsert) {
		s.UpdateIsDefault()
	})
}

// SetName sets the "name" field.
func (u *TeamUpsertOne) SetName(v string) *TeamUpsertOne {
	return u.Update(func(s *TeamUpsert) {
		s.SetName(v)
	})
}

// UpdateName sets the "name" field to the value that was provided on create.
func (u *TeamUpsertOne) UpdateName() *TeamUpsertOne {
	return u.Update(func(s *TeamUpsert) {
		s.UpdateName()
	})
}

// SetTier sets the "tier" field.
func (u *TeamUpsertOne) SetTier(v string) *TeamUpsertOne {
	return u.Update(func(s *TeamUpsert) {
		s.SetTier(v)
	})
}

// UpdateTier sets the "tier" field to the value that was provided on create.
func (u *TeamUpsertOne) UpdateTier() *TeamUpsertOne {
	return u.Update(func(s *TeamUpsert) {
		s.UpdateTier()
	})
}

// SetIsBlocked sets the "is_blocked" field.
func (u *TeamUpsertOne) SetIsBlocked(v bool) *TeamUpsertOne {
	return u.Update(func(s *TeamUpsert) {
		s.SetIsBlocked(v)
	})
}

// UpdateIsBlocked sets the "is_blocked" field to the value that was provided on create.
func (u *TeamUpsertOne) UpdateIsBlocked() *TeamUpsertOne {
	return u.Update(func(s *TeamUpsert) {
		s.UpdateIsBlocked()
	})
}

// Exec executes the query.
func (u *TeamUpsertOne) Exec(ctx context.Context) error {
	if len(u.create.conflict) == 0 {
		return errors.New("ent: missing options for TeamCreate.OnConflict")
	}
	return u.create.Exec(ctx)
}

// ExecX is like Exec, but panics if an error occurs.
func (u *TeamUpsertOne) ExecX(ctx context.Context) {
	if err := u.create.Exec(ctx); err != nil {
		panic(err)
	}
}

// Exec executes the UPSERT query and returns the inserted/updated ID.
func (u *TeamUpsertOne) ID(ctx context.Context) (id uuid.UUID, err error) {
	if u.create.driver.Dialect() == dialect.MySQL {
		// In case of "ON CONFLICT", there is no way to get back non-numeric ID
		// fields from the database since MySQL does not support the RETURNING clause.
		return id, errors.New("ent: TeamUpsertOne.ID is not supported by MySQL driver. Use TeamUpsertOne.Exec instead")
	}
	node, err := u.create.Save(ctx)
	if err != nil {
		return id, err
	}
	return node.ID, nil
}

// IDX is like ID, but panics if an error occurs.
func (u *TeamUpsertOne) IDX(ctx context.Context) uuid.UUID {
	id, err := u.ID(ctx)
	if err != nil {
		panic(err)
	}
	return id
}

// TeamCreateBulk is the builder for creating many Team entities in bulk.
type TeamCreateBulk struct {
	config
	err      error
	builders []*TeamCreate
	conflict []sql.ConflictOption
}

// Save creates the Team entities in the database.
func (tcb *TeamCreateBulk) Save(ctx context.Context) ([]*Team, error) {
	if tcb.err != nil {
		return nil, tcb.err
	}
	specs := make([]*sqlgraph.CreateSpec, len(tcb.builders))
	nodes := make([]*Team, len(tcb.builders))
	mutators := make([]Mutator, len(tcb.builders))
	for i := range tcb.builders {
		func(i int, root context.Context) {
			builder := tcb.builders[i]
			builder.defaults()
			var mut Mutator = MutateFunc(func(ctx context.Context, m Mutation) (Value, error) {
				mutation, ok := m.(*TeamMutation)
				if !ok {
					return nil, fmt.Errorf("unexpected mutation type %T", m)
				}
				if err := builder.check(); err != nil {
					return nil, err
				}
				builder.mutation = mutation
				var err error
				nodes[i], specs[i] = builder.createSpec()
				if i < len(mutators)-1 {
					_, err = mutators[i+1].Mutate(root, tcb.builders[i+1].mutation)
				} else {
					spec := &sqlgraph.BatchCreateSpec{Nodes: specs}
					spec.OnConflict = tcb.conflict
					// Invoke the actual operation on the latest mutation in the chain.
					if err = sqlgraph.BatchCreate(ctx, tcb.driver, spec); err != nil {
						if sqlgraph.IsConstraintError(err) {
							err = &ConstraintError{msg: err.Error(), wrap: err}
						}
					}
				}
				if err != nil {
					return nil, err
				}
				mutation.id = &nodes[i].ID
				mutation.done = true
				return nodes[i], nil
			})
			for i := len(builder.hooks) - 1; i >= 0; i-- {
				mut = builder.hooks[i](mut)
			}
			mutators[i] = mut
		}(i, ctx)
	}
	if len(mutators) > 0 {
		if _, err := mutators[0].Mutate(ctx, tcb.builders[0].mutation); err != nil {
			return nil, err
		}
	}
	return nodes, nil
}

// SaveX is like Save, but panics if an error occurs.
func (tcb *TeamCreateBulk) SaveX(ctx context.Context) []*Team {
	v, err := tcb.Save(ctx)
	if err != nil {
		panic(err)
	}
	return v
}

// Exec executes the query.
func (tcb *TeamCreateBulk) Exec(ctx context.Context) error {
	_, err := tcb.Save(ctx)
	return err
}

// ExecX is like Exec, but panics if an error occurs.
func (tcb *TeamCreateBulk) ExecX(ctx context.Context) {
	if err := tcb.Exec(ctx); err != nil {
		panic(err)
	}
}

// OnConflict allows configuring the `ON CONFLICT` / `ON DUPLICATE KEY` clause
// of the `INSERT` statement. For example:
//
//	client.Team.CreateBulk(builders...).
//		OnConflict(
//			// Update the row with the new values
//			// the was proposed for insertion.
//			sql.ResolveWithNewValues(),
//		).
//		// Override some of the fields with custom
//		// update values.
//		Update(func(u *ent.TeamUpsert) {
//			SetCreatedAt(v+v).
//		}).
//		Exec(ctx)
func (tcb *TeamCreateBulk) OnConflict(opts ...sql.ConflictOption) *TeamUpsertBulk {
	tcb.conflict = opts
	return &TeamUpsertBulk{
		create: tcb,
	}
}

// OnConflictColumns calls `OnConflict` and configures the columns
// as conflict target. Using this option is equivalent to using:
//
//	client.Team.Create().
//		OnConflict(sql.ConflictColumns(columns...)).
//		Exec(ctx)
func (tcb *TeamCreateBulk) OnConflictColumns(columns ...string) *TeamUpsertBulk {
	tcb.conflict = append(tcb.conflict, sql.ConflictColumns(columns...))
	return &TeamUpsertBulk{
		create: tcb,
	}
}

// TeamUpsertBulk is the builder for "upsert"-ing
// a bulk of Team nodes.
type TeamUpsertBulk struct {
	create *TeamCreateBulk
}

// UpdateNewValues updates the mutable fields using the new values that
// were set on create. Using this option is equivalent to using:
//
//	client.Team.Create().
//		OnConflict(
//			sql.ResolveWithNewValues(),
//			sql.ResolveWith(func(u *sql.UpdateSet) {
//				u.SetIgnore(team.FieldID)
//			}),
//		).
//		Exec(ctx)
func (u *TeamUpsertBulk) UpdateNewValues() *TeamUpsertBulk {
	u.create.conflict = append(u.create.conflict, sql.ResolveWithNewValues())
	u.create.conflict = append(u.create.conflict, sql.ResolveWith(func(s *sql.UpdateSet) {
		for _, b := range u.create.builders {
			if _, exists := b.mutation.ID(); exists {
				s.SetIgnore(team.FieldID)
			}
			if _, exists := b.mutation.CreatedAt(); exists {
				s.SetIgnore(team.FieldCreatedAt)
			}
		}
	}))
	return u
}

// Ignore sets each column to itself in case of conflict.
// Using this option is equivalent to using:
//
//	client.Team.Create().
//		OnConflict(sql.ResolveWithIgnore()).
//		Exec(ctx)
func (u *TeamUpsertBulk) Ignore() *TeamUpsertBulk {
	u.create.conflict = append(u.create.conflict, sql.ResolveWithIgnore())
	return u
}

// DoNothing configures the conflict_action to `DO NOTHING`.
// Supported only by SQLite and PostgreSQL.
func (u *TeamUpsertBulk) DoNothing() *TeamUpsertBulk {
	u.create.conflict = append(u.create.conflict, sql.DoNothing())
	return u
}

// Update allows overriding fields `UPDATE` values. See the TeamCreateBulk.OnConflict
// documentation for more info.
func (u *TeamUpsertBulk) Update(set func(*TeamUpsert)) *TeamUpsertBulk {
	u.create.conflict = append(u.create.conflict, sql.ResolveWith(func(update *sql.UpdateSet) {
		set(&TeamUpsert{UpdateSet: update})
	}))
	return u
}

// SetIsDefault sets the "is_default" field.
func (u *TeamUpsertBulk) SetIsDefault(v bool) *TeamUpsertBulk {
	return u.Update(func(s *TeamUpsert) {
		s.SetIsDefault(v)
	})
}

// UpdateIsDefault sets the "is_default" field to the value that was provided on create.
func (u *TeamUpsertBulk) UpdateIsDefault() *TeamUpsertBulk {
	return u.Update(func(s *TeamUpsert) {
		s.UpdateIsDefault()
	})
}

// SetName sets the "name" field.
func (u *TeamUpsertBulk) SetName(v string) *TeamUpsertBulk {
	return u.Update(func(s *TeamUpsert) {
		s.SetName(v)
	})
}

// UpdateName sets the "name" field to the value that was provided on create.
func (u *TeamUpsertBulk) UpdateName() *TeamUpsertBulk {
	return u.Update(func(s *TeamUpsert) {
		s.UpdateName()
	})
}

// SetTier sets the "tier" field.
func (u *TeamUpsertBulk) SetTier(v string) *TeamUpsertBulk {
	return u.Update(func(s *TeamUpsert) {
		s.SetTier(v)
	})
}

// UpdateTier sets the "tier" field to the value that was provided on create.
func (u *TeamUpsertBulk) UpdateTier() *TeamUpsertBulk {
	return u.Update(func(s *TeamUpsert) {
		s.UpdateTier()
	})
}

// SetIsBlocked sets the "is_blocked" field.
func (u *TeamUpsertBulk) SetIsBlocked(v bool) *TeamUpsertBulk {
	return u.Update(func(s *TeamUpsert) {
		s.SetIsBlocked(v)
	})
}

// UpdateIsBlocked sets the "is_blocked" field to the value that was provided on create.
func (u *TeamUpsertBulk) UpdateIsBlocked() *TeamUpsertBulk {
	return u.Update(func(s *TeamUpsert) {
		s.UpdateIsBlocked()
	})
}

// Exec executes the query.
func (u *TeamUpsertBulk) Exec(ctx context.Context) error {
	if u.create.err != nil {
		return u.create.err
	}
	for i, b := range u.create.builders {
		if len(b.conflict) != 0 {
			return fmt.Errorf("ent: OnConflict was set for builder %d. Set it on the TeamCreateBulk instead", i)
		}
	}
	if len(u.create.conflict) == 0 {
		return errors.New("ent: missing options for TeamCreateBulk.OnConflict")
	}
	return u.create.Exec(ctx)
}

// ExecX is like Exec, but panics if an error occurs.
func (u *TeamUpsertBulk) ExecX(ctx context.Context) {
	if err := u.create.Exec(ctx); err != nil {
		panic(err)
	}
}