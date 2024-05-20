module github.com/e2b-dev/infra/packages/docker-reverse-proxy

go 1.22

replace github.com/e2b-dev/infra/packages/shared v0.0.0 => ../shared

require (
	github.com/e2b-dev/infra/packages/shared v0.0.0
	github.com/jellydator/ttlcache/v3 v3.2.0
)

require (
	ariga.io/atlas v0.15.0 // indirect
	entgo.io/ent v0.12.5 // indirect
	github.com/agext/levenshtein v1.2.3 // indirect
	github.com/apparentlymart/go-textseg/v15 v15.0.0 // indirect
	github.com/go-openapi/inflect v0.19.0 // indirect
	github.com/go-test/deep v1.0.8 // indirect
	github.com/google/go-cmp v0.6.0 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/hashicorp/hcl/v2 v2.19.1 // indirect
	github.com/lib/pq v1.10.9 // indirect
	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
	github.com/zclconf/go-cty v1.14.1 // indirect
	golang.org/x/mod v0.14.0 // indirect
	golang.org/x/sync v0.6.0 // indirect
	golang.org/x/text v0.14.0 // indirect
)
