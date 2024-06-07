module github.com/e2b-dev/infra/packages/envd

go 1.22

require (
	connectrpc.com/connect v1.16.2
	connectrpc.com/cors v0.1.0
	github.com/creack/pty v1.1.18
	github.com/deepmap/oapi-codegen/v2 v2.1.1-0.20240519200907-da9077bb5ffe
	github.com/drael/GOnetstat v0.0.0-20201004132414-bf4a88b0bdab
	github.com/e2b-dev/infra/packages/shared v0.0.0
	github.com/fsnotify/fsnotify v1.7.0
	github.com/oapi-codegen/runtime v1.1.1
	github.com/rs/cors v1.11.0
	golang.org/x/sync v0.7.0
	google.golang.org/protobuf v1.34.1
)

require (
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/getkin/kin-openapi v0.123.0 // indirect
	github.com/go-openapi/jsonpointer v0.20.2 // indirect
	github.com/go-openapi/swag v0.22.8 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/invopop/yaml v0.2.0 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mohae/deepcopy v0.0.0-20170929034955-c48cc78d4826 // indirect
	github.com/orcaman/concurrent-map/v2 v2.0.1 // indirect
	github.com/perimeterx/marshmallow v1.1.5 // indirect
	github.com/rs/zerolog v1.33.0 // indirect
	golang.org/x/mod v0.17.0 // indirect
	golang.org/x/sys v0.20.0 // indirect
	golang.org/x/text v0.15.0 // indirect
	golang.org/x/tools v0.20.0 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/e2b-dev/infra/packages/shared v0.0.0 => ../shared
