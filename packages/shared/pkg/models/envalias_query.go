// Code generated by ent, DO NOT EDIT.

package models

import (
	"context"
	"fmt"
	"math"

	"entgo.io/ent/dialect/sql"
	"entgo.io/ent/dialect/sql/sqlgraph"
	"entgo.io/ent/schema/field"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/env"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/envalias"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/internal"
	"github.com/e2b-dev/infra/packages/shared/pkg/models/predicate"
)

// EnvAliasQuery is the builder for querying EnvAlias entities.
type EnvAliasQuery struct {
	config
	ctx        *QueryContext
	order      []envalias.OrderOption
	inters     []Interceptor
	predicates []predicate.EnvAlias
	withEnv    *EnvQuery
	modifiers  []func(*sql.Selector)
	// intermediate query (i.e. traversal path).
	sql  *sql.Selector
	path func(context.Context) (*sql.Selector, error)
}

// Where adds a new predicate for the EnvAliasQuery builder.
func (eaq *EnvAliasQuery) Where(ps ...predicate.EnvAlias) *EnvAliasQuery {
	eaq.predicates = append(eaq.predicates, ps...)
	return eaq
}

// Limit the number of records to be returned by this query.
func (eaq *EnvAliasQuery) Limit(limit int) *EnvAliasQuery {
	eaq.ctx.Limit = &limit
	return eaq
}

// Offset to start from.
func (eaq *EnvAliasQuery) Offset(offset int) *EnvAliasQuery {
	eaq.ctx.Offset = &offset
	return eaq
}

// Unique configures the query builder to filter duplicate records on query.
// By default, unique is set to true, and can be disabled using this method.
func (eaq *EnvAliasQuery) Unique(unique bool) *EnvAliasQuery {
	eaq.ctx.Unique = &unique
	return eaq
}

// Order specifies how the records should be ordered.
func (eaq *EnvAliasQuery) Order(o ...envalias.OrderOption) *EnvAliasQuery {
	eaq.order = append(eaq.order, o...)
	return eaq
}

// QueryEnv chains the current query on the "env" edge.
func (eaq *EnvAliasQuery) QueryEnv() *EnvQuery {
	query := (&EnvClient{config: eaq.config}).Query()
	query.path = func(ctx context.Context) (fromU *sql.Selector, err error) {
		if err := eaq.prepareQuery(ctx); err != nil {
			return nil, err
		}
		selector := eaq.sqlQuery(ctx)
		if err := selector.Err(); err != nil {
			return nil, err
		}
		step := sqlgraph.NewStep(
			sqlgraph.From(envalias.Table, envalias.FieldID, selector),
			sqlgraph.To(env.Table, env.FieldID),
			sqlgraph.Edge(sqlgraph.M2O, true, envalias.EnvTable, envalias.EnvColumn),
		)
		schemaConfig := eaq.schemaConfig
		step.To.Schema = schemaConfig.Env
		step.Edge.Schema = schemaConfig.EnvAlias
		fromU = sqlgraph.SetNeighbors(eaq.driver.Dialect(), step)
		return fromU, nil
	}
	return query
}

// First returns the first EnvAlias entity from the query.
// Returns a *NotFoundError when no EnvAlias was found.
func (eaq *EnvAliasQuery) First(ctx context.Context) (*EnvAlias, error) {
	nodes, err := eaq.Limit(1).All(setContextOp(ctx, eaq.ctx, "First"))
	if err != nil {
		return nil, err
	}
	if len(nodes) == 0 {
		return nil, &NotFoundError{envalias.Label}
	}
	return nodes[0], nil
}

// FirstX is like First, but panics if an error occurs.
func (eaq *EnvAliasQuery) FirstX(ctx context.Context) *EnvAlias {
	node, err := eaq.First(ctx)
	if err != nil && !IsNotFound(err) {
		panic(err)
	}
	return node
}

// FirstID returns the first EnvAlias ID from the query.
// Returns a *NotFoundError when no EnvAlias ID was found.
func (eaq *EnvAliasQuery) FirstID(ctx context.Context) (id string, err error) {
	var ids []string
	if ids, err = eaq.Limit(1).IDs(setContextOp(ctx, eaq.ctx, "FirstID")); err != nil {
		return
	}
	if len(ids) == 0 {
		err = &NotFoundError{envalias.Label}
		return
	}
	return ids[0], nil
}

// FirstIDX is like FirstID, but panics if an error occurs.
func (eaq *EnvAliasQuery) FirstIDX(ctx context.Context) string {
	id, err := eaq.FirstID(ctx)
	if err != nil && !IsNotFound(err) {
		panic(err)
	}
	return id
}

// Only returns a single EnvAlias entity found by the query, ensuring it only returns one.
// Returns a *NotSingularError when more than one EnvAlias entity is found.
// Returns a *NotFoundError when no EnvAlias entities are found.
func (eaq *EnvAliasQuery) Only(ctx context.Context) (*EnvAlias, error) {
	nodes, err := eaq.Limit(2).All(setContextOp(ctx, eaq.ctx, "Only"))
	if err != nil {
		return nil, err
	}
	switch len(nodes) {
	case 1:
		return nodes[0], nil
	case 0:
		return nil, &NotFoundError{envalias.Label}
	default:
		return nil, &NotSingularError{envalias.Label}
	}
}

// OnlyX is like Only, but panics if an error occurs.
func (eaq *EnvAliasQuery) OnlyX(ctx context.Context) *EnvAlias {
	node, err := eaq.Only(ctx)
	if err != nil {
		panic(err)
	}
	return node
}

// OnlyID is like Only, but returns the only EnvAlias ID in the query.
// Returns a *NotSingularError when more than one EnvAlias ID is found.
// Returns a *NotFoundError when no entities are found.
func (eaq *EnvAliasQuery) OnlyID(ctx context.Context) (id string, err error) {
	var ids []string
	if ids, err = eaq.Limit(2).IDs(setContextOp(ctx, eaq.ctx, "OnlyID")); err != nil {
		return
	}
	switch len(ids) {
	case 1:
		id = ids[0]
	case 0:
		err = &NotFoundError{envalias.Label}
	default:
		err = &NotSingularError{envalias.Label}
	}
	return
}

// OnlyIDX is like OnlyID, but panics if an error occurs.
func (eaq *EnvAliasQuery) OnlyIDX(ctx context.Context) string {
	id, err := eaq.OnlyID(ctx)
	if err != nil {
		panic(err)
	}
	return id
}

// All executes the query and returns a list of EnvAliasSlice.
func (eaq *EnvAliasQuery) All(ctx context.Context) ([]*EnvAlias, error) {
	ctx = setContextOp(ctx, eaq.ctx, "All")
	if err := eaq.prepareQuery(ctx); err != nil {
		return nil, err
	}
	qr := querierAll[[]*EnvAlias, *EnvAliasQuery]()
	return withInterceptors[[]*EnvAlias](ctx, eaq, qr, eaq.inters)
}

// AllX is like All, but panics if an error occurs.
func (eaq *EnvAliasQuery) AllX(ctx context.Context) []*EnvAlias {
	nodes, err := eaq.All(ctx)
	if err != nil {
		panic(err)
	}
	return nodes
}

// IDs executes the query and returns a list of EnvAlias IDs.
func (eaq *EnvAliasQuery) IDs(ctx context.Context) (ids []string, err error) {
	if eaq.ctx.Unique == nil && eaq.path != nil {
		eaq.Unique(true)
	}
	ctx = setContextOp(ctx, eaq.ctx, "IDs")
	if err = eaq.Select(envalias.FieldID).Scan(ctx, &ids); err != nil {
		return nil, err
	}
	return ids, nil
}

// IDsX is like IDs, but panics if an error occurs.
func (eaq *EnvAliasQuery) IDsX(ctx context.Context) []string {
	ids, err := eaq.IDs(ctx)
	if err != nil {
		panic(err)
	}
	return ids
}

// Count returns the count of the given query.
func (eaq *EnvAliasQuery) Count(ctx context.Context) (int, error) {
	ctx = setContextOp(ctx, eaq.ctx, "Count")
	if err := eaq.prepareQuery(ctx); err != nil {
		return 0, err
	}
	return withInterceptors[int](ctx, eaq, querierCount[*EnvAliasQuery](), eaq.inters)
}

// CountX is like Count, but panics if an error occurs.
func (eaq *EnvAliasQuery) CountX(ctx context.Context) int {
	count, err := eaq.Count(ctx)
	if err != nil {
		panic(err)
	}
	return count
}

// Exist returns true if the query has elements in the graph.
func (eaq *EnvAliasQuery) Exist(ctx context.Context) (bool, error) {
	ctx = setContextOp(ctx, eaq.ctx, "Exist")
	switch _, err := eaq.FirstID(ctx); {
	case IsNotFound(err):
		return false, nil
	case err != nil:
		return false, fmt.Errorf("models: check existence: %w", err)
	default:
		return true, nil
	}
}

// ExistX is like Exist, but panics if an error occurs.
func (eaq *EnvAliasQuery) ExistX(ctx context.Context) bool {
	exist, err := eaq.Exist(ctx)
	if err != nil {
		panic(err)
	}
	return exist
}

// Clone returns a duplicate of the EnvAliasQuery builder, including all associated steps. It can be
// used to prepare common query builders and use them differently after the clone is made.
func (eaq *EnvAliasQuery) Clone() *EnvAliasQuery {
	if eaq == nil {
		return nil
	}
	return &EnvAliasQuery{
		config:     eaq.config,
		ctx:        eaq.ctx.Clone(),
		order:      append([]envalias.OrderOption{}, eaq.order...),
		inters:     append([]Interceptor{}, eaq.inters...),
		predicates: append([]predicate.EnvAlias{}, eaq.predicates...),
		withEnv:    eaq.withEnv.Clone(),
		// clone intermediate query.
		sql:  eaq.sql.Clone(),
		path: eaq.path,
	}
}

// WithEnv tells the query-builder to eager-load the nodes that are connected to
// the "env" edge. The optional arguments are used to configure the query builder of the edge.
func (eaq *EnvAliasQuery) WithEnv(opts ...func(*EnvQuery)) *EnvAliasQuery {
	query := (&EnvClient{config: eaq.config}).Query()
	for _, opt := range opts {
		opt(query)
	}
	eaq.withEnv = query
	return eaq
}

// GroupBy is used to group vertices by one or more fields/columns.
// It is often used with aggregate functions, like: count, max, mean, min, sum.
//
// Example:
//
//	var v []struct {
//		EnvID string `json:"env_id,omitempty"`
//		Count int `json:"count,omitempty"`
//	}
//
//	client.EnvAlias.Query().
//		GroupBy(envalias.FieldEnvID).
//		Aggregate(models.Count()).
//		Scan(ctx, &v)
func (eaq *EnvAliasQuery) GroupBy(field string, fields ...string) *EnvAliasGroupBy {
	eaq.ctx.Fields = append([]string{field}, fields...)
	grbuild := &EnvAliasGroupBy{build: eaq}
	grbuild.flds = &eaq.ctx.Fields
	grbuild.label = envalias.Label
	grbuild.scan = grbuild.Scan
	return grbuild
}

// Select allows the selection one or more fields/columns for the given query,
// instead of selecting all fields in the entity.
//
// Example:
//
//	var v []struct {
//		EnvID string `json:"env_id,omitempty"`
//	}
//
//	client.EnvAlias.Query().
//		Select(envalias.FieldEnvID).
//		Scan(ctx, &v)
func (eaq *EnvAliasQuery) Select(fields ...string) *EnvAliasSelect {
	eaq.ctx.Fields = append(eaq.ctx.Fields, fields...)
	sbuild := &EnvAliasSelect{EnvAliasQuery: eaq}
	sbuild.label = envalias.Label
	sbuild.flds, sbuild.scan = &eaq.ctx.Fields, sbuild.Scan
	return sbuild
}

// Aggregate returns a EnvAliasSelect configured with the given aggregations.
func (eaq *EnvAliasQuery) Aggregate(fns ...AggregateFunc) *EnvAliasSelect {
	return eaq.Select().Aggregate(fns...)
}

func (eaq *EnvAliasQuery) prepareQuery(ctx context.Context) error {
	for _, inter := range eaq.inters {
		if inter == nil {
			return fmt.Errorf("models: uninitialized interceptor (forgotten import models/runtime?)")
		}
		if trv, ok := inter.(Traverser); ok {
			if err := trv.Traverse(ctx, eaq); err != nil {
				return err
			}
		}
	}
	for _, f := range eaq.ctx.Fields {
		if !envalias.ValidColumn(f) {
			return &ValidationError{Name: f, err: fmt.Errorf("models: invalid field %q for query", f)}
		}
	}
	if eaq.path != nil {
		prev, err := eaq.path(ctx)
		if err != nil {
			return err
		}
		eaq.sql = prev
	}
	return nil
}

func (eaq *EnvAliasQuery) sqlAll(ctx context.Context, hooks ...queryHook) ([]*EnvAlias, error) {
	var (
		nodes       = []*EnvAlias{}
		_spec       = eaq.querySpec()
		loadedTypes = [1]bool{
			eaq.withEnv != nil,
		}
	)
	_spec.ScanValues = func(columns []string) ([]any, error) {
		return (*EnvAlias).scanValues(nil, columns)
	}
	_spec.Assign = func(columns []string, values []any) error {
		node := &EnvAlias{config: eaq.config}
		nodes = append(nodes, node)
		node.Edges.loadedTypes = loadedTypes
		return node.assignValues(columns, values)
	}
	_spec.Node.Schema = eaq.schemaConfig.EnvAlias
	ctx = internal.NewSchemaConfigContext(ctx, eaq.schemaConfig)
	if len(eaq.modifiers) > 0 {
		_spec.Modifiers = eaq.modifiers
	}
	for i := range hooks {
		hooks[i](ctx, _spec)
	}
	if err := sqlgraph.QueryNodes(ctx, eaq.driver, _spec); err != nil {
		return nil, err
	}
	if len(nodes) == 0 {
		return nodes, nil
	}
	if query := eaq.withEnv; query != nil {
		if err := eaq.loadEnv(ctx, query, nodes, nil,
			func(n *EnvAlias, e *Env) { n.Edges.Env = e }); err != nil {
			return nil, err
		}
	}
	return nodes, nil
}

func (eaq *EnvAliasQuery) loadEnv(ctx context.Context, query *EnvQuery, nodes []*EnvAlias, init func(*EnvAlias), assign func(*EnvAlias, *Env)) error {
	ids := make([]string, 0, len(nodes))
	nodeids := make(map[string][]*EnvAlias)
	for i := range nodes {
		if nodes[i].EnvID == nil {
			continue
		}
		fk := *nodes[i].EnvID
		if _, ok := nodeids[fk]; !ok {
			ids = append(ids, fk)
		}
		nodeids[fk] = append(nodeids[fk], nodes[i])
	}
	if len(ids) == 0 {
		return nil
	}
	query.Where(env.IDIn(ids...))
	neighbors, err := query.All(ctx)
	if err != nil {
		return err
	}
	for _, n := range neighbors {
		nodes, ok := nodeids[n.ID]
		if !ok {
			return fmt.Errorf(`unexpected foreign-key "env_id" returned %v`, n.ID)
		}
		for i := range nodes {
			assign(nodes[i], n)
		}
	}
	return nil
}

func (eaq *EnvAliasQuery) sqlCount(ctx context.Context) (int, error) {
	_spec := eaq.querySpec()
	_spec.Node.Schema = eaq.schemaConfig.EnvAlias
	ctx = internal.NewSchemaConfigContext(ctx, eaq.schemaConfig)
	if len(eaq.modifiers) > 0 {
		_spec.Modifiers = eaq.modifiers
	}
	_spec.Node.Columns = eaq.ctx.Fields
	if len(eaq.ctx.Fields) > 0 {
		_spec.Unique = eaq.ctx.Unique != nil && *eaq.ctx.Unique
	}
	return sqlgraph.CountNodes(ctx, eaq.driver, _spec)
}

func (eaq *EnvAliasQuery) querySpec() *sqlgraph.QuerySpec {
	_spec := sqlgraph.NewQuerySpec(envalias.Table, envalias.Columns, sqlgraph.NewFieldSpec(envalias.FieldID, field.TypeString))
	_spec.From = eaq.sql
	if unique := eaq.ctx.Unique; unique != nil {
		_spec.Unique = *unique
	} else if eaq.path != nil {
		_spec.Unique = true
	}
	if fields := eaq.ctx.Fields; len(fields) > 0 {
		_spec.Node.Columns = make([]string, 0, len(fields))
		_spec.Node.Columns = append(_spec.Node.Columns, envalias.FieldID)
		for i := range fields {
			if fields[i] != envalias.FieldID {
				_spec.Node.Columns = append(_spec.Node.Columns, fields[i])
			}
		}
		if eaq.withEnv != nil {
			_spec.Node.AddColumnOnce(envalias.FieldEnvID)
		}
	}
	if ps := eaq.predicates; len(ps) > 0 {
		_spec.Predicate = func(selector *sql.Selector) {
			for i := range ps {
				ps[i](selector)
			}
		}
	}
	if limit := eaq.ctx.Limit; limit != nil {
		_spec.Limit = *limit
	}
	if offset := eaq.ctx.Offset; offset != nil {
		_spec.Offset = *offset
	}
	if ps := eaq.order; len(ps) > 0 {
		_spec.Order = func(selector *sql.Selector) {
			for i := range ps {
				ps[i](selector)
			}
		}
	}
	return _spec
}

func (eaq *EnvAliasQuery) sqlQuery(ctx context.Context) *sql.Selector {
	builder := sql.Dialect(eaq.driver.Dialect())
	t1 := builder.Table(envalias.Table)
	columns := eaq.ctx.Fields
	if len(columns) == 0 {
		columns = envalias.Columns
	}
	selector := builder.Select(t1.Columns(columns...)...).From(t1)
	if eaq.sql != nil {
		selector = eaq.sql
		selector.Select(selector.Columns(columns...)...)
	}
	if eaq.ctx.Unique != nil && *eaq.ctx.Unique {
		selector.Distinct()
	}
	t1.Schema(eaq.schemaConfig.EnvAlias)
	ctx = internal.NewSchemaConfigContext(ctx, eaq.schemaConfig)
	selector.WithContext(ctx)
	for _, m := range eaq.modifiers {
		m(selector)
	}
	for _, p := range eaq.predicates {
		p(selector)
	}
	for _, p := range eaq.order {
		p(selector)
	}
	if offset := eaq.ctx.Offset; offset != nil {
		// limit is mandatory for offset clause. We start
		// with default value, and override it below if needed.
		selector.Offset(*offset).Limit(math.MaxInt32)
	}
	if limit := eaq.ctx.Limit; limit != nil {
		selector.Limit(*limit)
	}
	return selector
}

// Modify adds a query modifier for attaching custom logic to queries.
func (eaq *EnvAliasQuery) Modify(modifiers ...func(s *sql.Selector)) *EnvAliasSelect {
	eaq.modifiers = append(eaq.modifiers, modifiers...)
	return eaq.Select()
}

// EnvAliasGroupBy is the group-by builder for EnvAlias entities.
type EnvAliasGroupBy struct {
	selector
	build *EnvAliasQuery
}

// Aggregate adds the given aggregation functions to the group-by query.
func (eagb *EnvAliasGroupBy) Aggregate(fns ...AggregateFunc) *EnvAliasGroupBy {
	eagb.fns = append(eagb.fns, fns...)
	return eagb
}

// Scan applies the selector query and scans the result into the given value.
func (eagb *EnvAliasGroupBy) Scan(ctx context.Context, v any) error {
	ctx = setContextOp(ctx, eagb.build.ctx, "GroupBy")
	if err := eagb.build.prepareQuery(ctx); err != nil {
		return err
	}
	return scanWithInterceptors[*EnvAliasQuery, *EnvAliasGroupBy](ctx, eagb.build, eagb, eagb.build.inters, v)
}

func (eagb *EnvAliasGroupBy) sqlScan(ctx context.Context, root *EnvAliasQuery, v any) error {
	selector := root.sqlQuery(ctx).Select()
	aggregation := make([]string, 0, len(eagb.fns))
	for _, fn := range eagb.fns {
		aggregation = append(aggregation, fn(selector))
	}
	if len(selector.SelectedColumns()) == 0 {
		columns := make([]string, 0, len(*eagb.flds)+len(eagb.fns))
		for _, f := range *eagb.flds {
			columns = append(columns, selector.C(f))
		}
		columns = append(columns, aggregation...)
		selector.Select(columns...)
	}
	selector.GroupBy(selector.Columns(*eagb.flds...)...)
	if err := selector.Err(); err != nil {
		return err
	}
	rows := &sql.Rows{}
	query, args := selector.Query()
	if err := eagb.build.driver.Query(ctx, query, args, rows); err != nil {
		return err
	}
	defer rows.Close()
	return sql.ScanSlice(rows, v)
}

// EnvAliasSelect is the builder for selecting fields of EnvAlias entities.
type EnvAliasSelect struct {
	*EnvAliasQuery
	selector
}

// Aggregate adds the given aggregation functions to the selector query.
func (eas *EnvAliasSelect) Aggregate(fns ...AggregateFunc) *EnvAliasSelect {
	eas.fns = append(eas.fns, fns...)
	return eas
}

// Scan applies the selector query and scans the result into the given value.
func (eas *EnvAliasSelect) Scan(ctx context.Context, v any) error {
	ctx = setContextOp(ctx, eas.ctx, "Select")
	if err := eas.prepareQuery(ctx); err != nil {
		return err
	}
	return scanWithInterceptors[*EnvAliasQuery, *EnvAliasSelect](ctx, eas.EnvAliasQuery, eas, eas.inters, v)
}

func (eas *EnvAliasSelect) sqlScan(ctx context.Context, root *EnvAliasQuery, v any) error {
	selector := root.sqlQuery(ctx)
	aggregation := make([]string, 0, len(eas.fns))
	for _, fn := range eas.fns {
		aggregation = append(aggregation, fn(selector))
	}
	switch n := len(*eas.selector.flds); {
	case n == 0 && len(aggregation) > 0:
		selector.Select(aggregation...)
	case n != 0 && len(aggregation) > 0:
		selector.AppendSelect(aggregation...)
	}
	rows := &sql.Rows{}
	query, args := selector.Query()
	if err := eas.driver.Query(ctx, query, args, rows); err != nil {
		return err
	}
	defer rows.Close()
	return sql.ScanSlice(rows, v)
}

// Modify adds a query modifier for attaching custom logic to queries.
func (eas *EnvAliasSelect) Modify(modifiers ...func(s *sql.Selector)) *EnvAliasSelect {
	eas.modifiers = append(eas.modifiers, modifiers...)
	return eas
}
