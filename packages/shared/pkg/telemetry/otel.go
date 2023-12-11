package telemetry

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
	metricExportPeriod        = 15 * time.Second
)

// InitOTLPExporter initializes an OTLP exporter, and configures the corresponding trace providers.
func InitOTLPExporter(serviceName, serviceVersion string) func() {
	attributes := []attribute.KeyValue{
		semconv.ServiceName(serviceName),
		semconv.ServiceVersion(serviceVersion),
		semconv.TelemetrySDKName("otel"),
		semconv.TelemetrySDKLanguageGo,
	}

	hostname, err := os.Hostname()
	if err == nil {
		attributes = append(attributes, semconv.HostName(hostname))
	}

	ctx := context.Background()

	res, err := resource.New(
		ctx,
		resource.WithSchemaURL(semconv.SchemaURL),
		resource.WithAttributes(attributes...),
	)
	if err != nil {
		panic(fmt.Errorf("failed to create resource: %w", err))
	}

	dialCtx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()

	conn, err := grpc.DialContext(dialCtx,
		otelCollectorGRPCEndpoint,
		// Note the use of insecure transport here. TLS is recommended in production.
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		panic(fmt.Errorf("failed to create gRPC connection to collector: %w", err))
	}

	// Set up a trace exporter
	traceExporter, err := otlptracegrpc.New(
		ctx,
		otlptracegrpc.WithGRPCConn(conn),
		otlptracegrpc.WithCompressor(gzip.Name),
	)
	if err != nil {
		panic(fmt.Errorf("failed to create trace exporter: %w", err))
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
		panic(fmt.Errorf("failed to create metric exporter: %w", err))
	}

	meterProvider := metric.NewMeterProvider(
		metric.WithResource(res),
		metric.WithReader(
			metric.NewPeriodicReader(
				metricExporter,
				metric.WithInterval(metricExportPeriod),
			),
		),
	)

	otel.SetMeterProvider(meterProvider)

	// Shutdown will flush any remaining spans and shut down the exporter.
	return func() {
		traceErr := tracerProvider.Shutdown(context.Background())
		if traceErr != nil {
			log.Println("failed to shutdown traces provider: %w", traceErr)
		}

		metricErr := meterProvider.Shutdown(context.Background())
		if metricErr != nil {
			log.Println("failed to shutdown OTLP metrics provider: %w", metricErr)
		}
	}
}
