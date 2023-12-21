CURRENT_ENV := $(shell cat ../../.last_used_env || echo "not-set")
-include ../../.env.${CURRENT_ENV}

.PHONY: generate-fc
generate-fc:
	cd pkg/fc && swagger generate client -f firecracker.yml -A firecracker

.PHONY: generate-models
generate-models:
	rm -rf pkg/models/*
	go generate ./pkg/generate_models.go

.PHONY: diff-migrations
diff-migrations:
	atlas migrate diff --env local

.PHONY: migrate
migrate:
	atlas migrate apply --env local --url $(POSTGRES_CONNECTION_STRING)
