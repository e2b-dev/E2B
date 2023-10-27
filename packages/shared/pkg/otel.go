package pkg

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/encoding/gzip"
)

const (
	otelCollectorGRPCEndpoint = "0.0.0.0:4317"
	metricExportPeriod        = 10 * time.Second
)

type ExtraAttribute struct {
	Key   string
	Value string
}

// InitOTLPExporter initializes an OTLP exporter, and configures the corresponding trace providers.
func InitOTLPExporter(serviceName string, serviceVersion string, extraAttributes ...attribute.KeyValue) (func(), error) {
	env := os.Getenv("ENVIRONMENT")
	if env == "" {
		return func() {}, nil
	}

	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}

	res, err := resource.New(
		context.Background(),
		resource.WithSchemaURL(semconv.SchemaURL),
		resource.WithAttributes(extraAttributes...),
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(serviceVersion),
			semconv.TelemetrySDKName("otel"),
			semconv.TelemetrySDKLanguageGo,
			semconv.ServiceName(serviceName),
			semconv.HostName(hostname),
			semconv.DeploymentEnvironment(env),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	conn, err := grpc.DialContext(ctx,
		otelCollectorGRPCEndpoint,
		// Note the use of insecure transport here. TLS is recommended in production.
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create gRPC connection to collector: %w", err)
	}

	// Set up a trace exporter
	traceExporter, err := otlptracegrpc.New(
		context.Background(),
		otlptracegrpc.WithGRPCConn(conn),
		otlptracegrpc.WithCompressor(gzip.Name),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create trace exporter: %w", err)
	}

	// Register the trace exporter with a TracerProvider, using a batch
	// span processor to aggregate spans before export.
	bsp := sdktrace.NewBatchSpanProcessor(traceExporter)
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithResource(res),
		sdktrace.WithSpanProcessor(bsp),
	)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	otel.SetTracerProvider(tracerProvider)

	metricExporter, err := otlpmetricgrpc.New(ctx, otlpmetricgrpc.WithGRPCConn(conn))
	if err != nil {
		return nil, err
	}

	meterProvider := metric.NewMeterProvider(
		metric.WithResource(res),
		metric.WithReader(metric.NewPeriodicReader(metricExporter,
			metric.WithInterval(metricExportPeriod))),
	)
	if err != nil {
		panic(err)
	}
	otel.SetMeterProvider(meterProvider)

	// Shutdown will flush any remaining spans and shut down the exporter.
	return func() {
		err := tracerProvider.Shutdown(context.Background())
		if err != nil {
			log.Fatalf("failed to shutdown OTLP exporter: %v", err)
		}
		if err := meterProvider.Shutdown(context.Background()); err != nil {
			log.Println(err)
		}
	}, nil
}

//	func setupMetrics() (func() error, error) {
//		return pipelines.NewMetricsPipeline(pipelines.PipelineConfig{
//			Endpoint:                c.MetricExporterEndpoint,
//			Insecure:                c.MetricExporterEndpointInsecure,
//			Headers:                 c.Headers,
//			Resource:                c.Resource,
//			ReportingPeriod:         c.MetricReportingPeriod,
//			TemporalityPreference:   c.MetricExporterTemporalityPreference,
//			MetricsBuiltinsEnabled:  c.MetricsBuiltinsEnabled,
//			MetricsBuiltinLibraries: c.MetricsBuiltinLibraries,
//			UseLightstepMetricsSDK:  c.UseLightstepMetricsSDK,
//		})
//	}
//
//	func NewMetricsPipeline() (func() error, error) {
//		var err error
//
//		period := 30 * time.Second
//
//		var provider metric.MeterProvider
//		var shutdown func() error
//
//		metricExporter, err := c.newOtelMetricsExporter(otelPref, otelSecure)
//			if err != nil {
//				return nil, fmt.Errorf("failed to create metric exporter: %v", err)
//			}
//			meterProvider := otelsdkmetric.NewMeterProvider(
//				otelsdkmetric.WithResource(c.Resource),
//				otelsdkmetric.WithReader(otelsdkmetric.NewPeriodicReader(
//					metricExporter,
//					otelsdkmetric.WithInterval(period),
//				)),
//			)
//			otel.SetMeterProvider(meterProvider)
//			provider = meterProvider
//			shutdown = func() error {
//				return meterProvider.Shutdown(context.Background())
//			}
//		}
//
//		if c.MetricsBuiltinsEnabled {
//			for _, lib := range c.MetricsBuiltinLibraries {
//				name, version, _ := strings.Cut(lib, ":")
//
//				if version == "" {
//					version = defaultVersion
//				}
//
//				vm, has := builtinMetricsVersions[name]
//				if !has {
//					otel.Handle(fmt.Errorf("unrecognized builtin: %q", name))
//					continue
//				}
//				fs, has := vm[version]
//				if !has {
//					otel.Handle(fmt.Errorf("unrecognized builtin version: %v: %q", name, version))
//					continue
//				}
//				for _, f := range fs {
//
//					if err := f(provider); err != nil {
//						otel.Handle(fmt.Errorf("failed to start %v instrumentation: %w", name, err))
//					}
//				}
//			}
//		}
//
//		otel.SetMeterProvider(provider)
//		return shutdown, nil
//	}
//
// //
// //func (c PipelineConfig) newOtelMetricsExporter(temporality otelsdkmetric.TemporalitySelector, secureOpt otelotlpmetricgrpc.Option) (otelsdkmetric.Exporter, error) {
// //	return otelotlpmetricgrpc.New(
// //		context.Background(),
// //		secureOpt,
// //		otelotlpmetricgrpc.WithTemporalitySelector(temporality),
// //		otelotlpmetricgrpc.WithEndpoint(c.Endpoint),
// //		otelotlpmetricgrpc.WithHeaders(c.Headers),
// //		otelotlpmetricgrpc.WithCompressor(gzip.Name),
// //	)
// //}
