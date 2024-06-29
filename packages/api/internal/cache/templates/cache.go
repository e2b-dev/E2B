package templatecache

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jellydator/ttlcache/v3"

	"github.com/e2b-dev/infra/packages/api/internal/api"
	"github.com/e2b-dev/infra/packages/shared/pkg/db"
	"github.com/e2b-dev/infra/packages/shared/pkg/models"
)

const templateInfoExpiration = 5 * time.Minute

type TemplateInfo struct {
	template *api.Template
	teamID   uuid.UUID
	build    *models.EnvBuild
}

type AliasCache struct {
	cache *ttlcache.Cache[string, string]
}

func NewAliasCache() *AliasCache {
	cache := ttlcache.New(ttlcache.WithTTL[string, string](templateInfoExpiration))

	go cache.Start()

	return &AliasCache{
		cache: cache,
	}
}

func (c *AliasCache) Get(alias string) (templateID string, err error) {
	item := c.cache.Get(alias)

	if item == nil {
		return "", fmt.Errorf("alias not found")
	}

	return item.Value(), nil
}

type TemplateCache struct {
	cache      *ttlcache.Cache[string, *TemplateInfo]
	db         *db.DB
	aliasCache *AliasCache
}

func NewTemplateCache(db *db.DB) *TemplateCache {
	cache := ttlcache.New(ttlcache.WithTTL[string, *TemplateInfo](templateInfoExpiration))
	aliasCache := NewAliasCache()
	go cache.Start()

	return &TemplateCache{
		cache:      cache,
		db:         db,
		aliasCache: aliasCache,
	}
}

func (c *TemplateCache) Get(ctx context.Context, aliasOrEnvID string, teamID uuid.UUID, public bool) (env *api.Template, build *models.EnvBuild, err error) {
	var envDB *db.Template
	var item *ttlcache.Item[string, *TemplateInfo]
	var templateInfo *TemplateInfo

	templateID, err := c.aliasCache.Get(aliasOrEnvID)
	if err == nil {
		item = c.cache.Get(templateID)
	}

	if item == nil {
		envDB, build, err = c.db.GetEnv(ctx, aliasOrEnvID, teamID, public)
		if err != nil {
			return nil, nil, fmt.Errorf("error when getting team auth: %w", err)
		}

		c.aliasCache.cache.Set(envDB.TemplateID, envDB.TemplateID, templateInfoExpiration)
		if envDB.Aliases != nil {
			for _, alias := range *envDB.Aliases {
				c.aliasCache.cache.Set(alias, envDB.TemplateID, templateInfoExpiration)
			}
		}

		templateInfo = &TemplateInfo{template: &api.Template{
			TemplateID: envDB.TemplateID,
			BuildID:    build.ID.String(),
			Public:     envDB.Public,
			Aliases:    envDB.Aliases,
		}, teamID: teamID, build: build}

		c.cache.Set(envDB.TemplateID, templateInfo, templateInfoExpiration)
	} else {
		templateInfo = item.Value()
	}

	if templateInfo.teamID != teamID && !templateInfo.template.Public {
		return nil, nil, fmt.Errorf("team does not have access to the environment")
	}

	return templateInfo.template, templateInfo.build, nil
}

// Invalidate invalidates the cache for the given templateID
func (c *TemplateCache) Invalidate(templateID string) {
	c.cache.Delete(templateID)
}
