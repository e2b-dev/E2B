module github.com/e2b-dev/infra/packages/api

go 1.21

require (
	cloud.google.com/go/artifactregistry v1.14.4
	cloud.google.com/go/storage v1.34.0
	entgo.io/ent v0.12.5
	github.com/dchest/uniuri v1.2.0
	github.com/deepmap/oapi-codegen v1.16.2
	github.com/e2b-dev/infra/packages/shared v0.0.0
	github.com/getkin/kin-openapi v0.120.0
	github.com/gin-contrib/cors v1.4.0
	github.com/gin-contrib/size v0.0.0-20230212012657-e14a14094dc4
	github.com/gin-gonic/gin v1.9.1
	github.com/hashicorp/nomad/api v0.0.0-20231031213001-c1fa145765b2
	github.com/jellydator/ttlcache/v3 v3.1.0
	github.com/lib/pq v1.10.9
	github.com/oapi-codegen/gin-middleware v1.0.1
	github.com/oapi-codegen/runtime v1.0.0
	github.com/orcaman/concurrent-map/v2 v2.0.1
	go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin v0.45.0
	go.opentelemetry.io/otel v1.19.0
	go.opentelemetry.io/otel/trace v1.19.0
	google.golang.org/api v0.149.0
)

require (
	ariga.io/atlas v0.15.0 // indirect
	cloud.google.com/go v0.110.10 // indirect
	cloud.google.com/go/compute v1.23.2 // indirect
	cloud.google.com/go/compute/metadata v0.2.4-0.20230617002413-005d2dfb6b68 // indirect
	cloud.google.com/go/iam v1.1.4 // indirect
	cloud.google.com/go/longrunning v0.5.3 // indirect
	github.com/HdrHistogram/hdrhistogram-go v1.1.2 // indirect
	github.com/agext/levenshtein v1.2.3 // indirect
	github.com/andybalholm/brotli v1.0.6 // indirect
	github.com/apache/arrow/go/v12 v12.0.1 // indirect
	github.com/apache/thrift v0.19.0 // indirect
	github.com/apparentlymart/go-textseg/v15 v15.0.0 // indirect
	github.com/axiomhq/hyperloglog v0.0.0-20230201085229-3ddf4bad03dc // indirect
	github.com/bytedance/sonic v1.10.2 // indirect
	github.com/cenkalti/backoff/v4 v4.2.1 // indirect
	github.com/chenzhuoyu/base64x v0.0.0-20230717121745-296ad89f973d // indirect
	github.com/chenzhuoyu/iasm v0.9.1 // indirect
	github.com/dgryski/go-farm v0.0.0-20200201041132-a6ae2369ad13 // indirect
	github.com/dgryski/go-metro v0.0.0-20211217172704-adc40b04c140 // indirect
	github.com/fsnotify/fsnotify v1.7.0 // indirect
	github.com/fxamacker/cbor/v2 v2.5.0 // indirect
	github.com/gabriel-vasile/mimetype v1.4.3 // indirect
	github.com/go-ole/go-ole v1.3.0 // indirect
	github.com/go-openapi/inflect v0.19.0 // indirect
	github.com/gogo/protobuf v1.3.2 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/golang/snappy v0.0.5-0.20220116011046-fa5810519dcb // indirect
	github.com/google/flatbuffers v23.5.26+incompatible // indirect
	github.com/google/go-cmp v0.6.0 // indirect
	github.com/google/s2a-go v0.1.7 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.2 // indirect
	github.com/googleapis/gax-go/v2 v2.12.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.18.0 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-multierror v1.1.1 // indirect
	github.com/hashicorp/hcl/v2 v2.19.1 // indirect
	github.com/klauspost/asmfmt v1.3.2 // indirect
	github.com/klauspost/compress v1.17.2 // indirect
	github.com/klauspost/cpuid/v2 v2.2.6 // indirect
	github.com/knadh/koanf/maps v0.1.1 // indirect
	github.com/knadh/koanf/providers/confmap v0.1.0 // indirect
	github.com/knadh/koanf/v2 v2.0.1 // indirect
	github.com/lightstep/go-expohisto v1.0.0 // indirect
	github.com/lightstep/otel-launcher-go v1.20.0 // indirect
	github.com/lightstep/otel-launcher-go/lightstep/instrumentation v1.20.0 // indirect
	github.com/lightstep/otel-launcher-go/lightstep/sdk/internal v1.20.0 // indirect
	github.com/lightstep/otel-launcher-go/lightstep/sdk/metric v1.20.0 // indirect
	github.com/lightstep/otel-launcher-go/pipelines v1.20.0 // indirect
	github.com/lufia/plan9stats v0.0.0-20231016141302-07b5767bb0ed // indirect
	github.com/minio/asm2plan9s v0.0.0-20200509001527-cdd76441f9d8 // indirect
	github.com/minio/c2goasm v0.0.0-20190812172519-36a3d3bbc4f3 // indirect
	github.com/mitchellh/copystructure v1.2.0 // indirect
	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
	github.com/mitchellh/reflectwalk v1.0.2 // indirect
	github.com/mostynb/go-grpc-compression v1.2.2 // indirect
	github.com/open-telemetry/otel-arrow v0.6.0 // indirect
	github.com/open-telemetry/otel-arrow/collector v0.6.0 // indirect
	github.com/perimeterx/marshmallow v1.1.5 // indirect
	github.com/pierrec/lz4/v4 v4.1.18 // indirect
	github.com/power-devops/perfstat v0.0.0-20221212215047-62379fc7944b // indirect
	github.com/sethvargo/go-envconfig v0.9.0 // indirect
	github.com/shirou/gopsutil/v3 v3.23.10 // indirect
	github.com/shoenig/go-m1cpu v0.1.6 // indirect
	github.com/tklauser/go-sysconf v0.3.12 // indirect
	github.com/tklauser/numcpus v0.6.1 // indirect
	github.com/twitchyliquid64/golang-asm v0.15.1 // indirect
	github.com/x448/float16 v0.8.4 // indirect
	github.com/yusufpapurcu/wmi v1.2.3 // indirect
	github.com/zclconf/go-cty v1.14.1 // indirect
	github.com/zeebo/xxh3 v1.0.2 // indirect
	go.opencensus.io v0.24.0 // indirect
	go.opentelemetry.io/collector v0.88.0 // indirect
	go.opentelemetry.io/collector/component v0.88.0 // indirect
	go.opentelemetry.io/collector/config/configauth v0.88.0 // indirect
	go.opentelemetry.io/collector/config/configcompression v0.88.0 // indirect
	go.opentelemetry.io/collector/config/configgrpc v0.88.0 // indirect
	go.opentelemetry.io/collector/config/confignet v0.88.0 // indirect
	go.opentelemetry.io/collector/config/configopaque v0.88.0 // indirect
	go.opentelemetry.io/collector/config/configtelemetry v0.88.0 // indirect
	go.opentelemetry.io/collector/config/configtls v0.88.0 // indirect
	go.opentelemetry.io/collector/config/internal v0.88.0 // indirect
	go.opentelemetry.io/collector/confmap v0.88.0 // indirect
	go.opentelemetry.io/collector/consumer v0.88.0 // indirect
	go.opentelemetry.io/collector/exporter v0.88.0 // indirect
	go.opentelemetry.io/collector/extension v0.88.0 // indirect
	go.opentelemetry.io/collector/extension/auth v0.88.0 // indirect
	go.opentelemetry.io/collector/featuregate v1.0.0-rcv0017 // indirect
	go.opentelemetry.io/collector/pdata v1.0.0-rcv0017 // indirect
	go.opentelemetry.io/collector/processor v0.88.0 // indirect
	go.opentelemetry.io/collector/processor/batchprocessor v0.88.0 // indirect
	go.opentelemetry.io/collector/receiver v0.88.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.45.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/host v0.45.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/runtime v0.45.0 // indirect
	go.opentelemetry.io/contrib/propagators/b3 v1.20.0 // indirect
	go.opentelemetry.io/contrib/propagators/ot v1.20.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlpmetric v0.42.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v0.42.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.19.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.19.0 // indirect
	go.opentelemetry.io/otel/sdk v1.19.0 // indirect
	go.opentelemetry.io/otel/sdk/metric v1.19.0 // indirect
	go.opentelemetry.io/proto/otlp v1.0.0 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	go.uber.org/zap v1.26.0 // indirect
	golang.org/x/arch v0.6.0 // indirect
	golang.org/x/exp v0.0.0-20231006140011-7918f672742d // indirect
	golang.org/x/mod v0.13.0 // indirect
	golang.org/x/oauth2 v0.13.0 // indirect
	golang.org/x/tools v0.14.0 // indirect
	golang.org/x/xerrors v0.0.0-20231012003039-104605ab7028 // indirect
	google.golang.org/appengine v1.6.8 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20231030173426-d783a09b4405 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20231030173426-d783a09b4405 // indirect
)

require (
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/gin-contrib/sse v0.1.0 // indirect
	github.com/go-logr/logr v1.3.0 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-openapi/jsonpointer v0.20.0 // indirect
	github.com/go-openapi/swag v0.22.4 // indirect
	github.com/go-playground/locales v0.14.1 // indirect
	github.com/go-playground/universal-translator v0.18.1 // indirect
	github.com/go-playground/validator/v10 v10.16.0 // indirect
	github.com/goccy/go-json v0.10.2 // indirect
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/google/uuid v1.4.0
	github.com/gorilla/mux v1.8.0 // indirect
	github.com/gorilla/websocket v1.5.0 // indirect
	github.com/hashicorp/cronexpr v1.1.2 // indirect
	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
	github.com/hashicorp/go-rootcerts v1.0.2 // indirect
	github.com/invopop/yaml v0.2.0 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/leodido/go-urn v1.2.4 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mitchellh/mapstructure v1.5.1-0.20220423185008-bf980b35cac4 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/mohae/deepcopy v0.0.0-20170929034955-c48cc78d4826 // indirect
	github.com/pelletier/go-toml/v2 v2.1.0 // indirect
	github.com/posthog/posthog-go v0.0.0-20230801140217-d607812dee69
	github.com/ugorji/go/codec v1.2.11 // indirect
	go.opentelemetry.io/otel/metric v1.19.0
	golang.org/x/crypto v0.15.0 // indirect
	golang.org/x/net v0.18.0 // indirect
	golang.org/x/sync v0.4.0 // indirect
	golang.org/x/sys v0.14.0 // indirect
	golang.org/x/text v0.14.0 // indirect
	google.golang.org/genproto v0.0.0-20231030173426-d783a09b4405 // indirect
	google.golang.org/grpc v1.59.0 // indirect
	google.golang.org/protobuf v1.31.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace github.com/e2b-dev/infra/packages/shared v0.0.0 => ../shared
