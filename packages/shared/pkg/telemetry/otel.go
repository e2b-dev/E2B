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
	metricExportPeriod        = 60 * time.Second
)

type client struct {
	tracerProvider *sdktrace.TracerProvider
	meterProvider  *metric.MeterProvider
}

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

	var otelClient client

	go func() {
		// Set up a connection to the collector.
		var conn *grpc.ClientConn

		retryInterval := 5 * time.Second

		for {
			dialCtx, cancel := context.WithTimeout(ctx, time.Second)

			conn, err = grpc.DialContext(dialCtx,
				otelCollectorGRPCEndpoint,
				// Note the use of insecure transport here. TLS is recommended in production.
				grpc.WithTransportCredentials(insecure.NewCredentials()),
				grpc.WithBlock(),
			)

			cancel()

			if err != nil {
				log.Printf("Failed to connect to collector: %v", err)
				time.Sleep(retryInterval)
			} else {
				break
			}
		}

		// Set up a trace exporter
		traceExporter, traceErr := otlptracegrpc.New(
			ctx,
			otlptracegrpc.WithGRPCConn(conn),
			otlptracegrpc.WithCompressor(gzip.Name),
		)
		if traceErr != nil {
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

		metricExporter, metricErr := otlpmetricgrpc.New(ctx, otlpmetricgrpc.WithGRPCConn(conn))
		if metricErr != nil {
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
	}()

	// Shutdown will flush any remaining spans and shut down the exporter.
	return func() {
		otelClient.close()
	}
}

func (c *client) close() {
	ctx := context.Background()

	if c.tracerProvider != nil {
		if err := c.tracerProvider.Shutdown(ctx); err != nil {
			log.Fatal(err)
		}
	}

	if c.meterProvider != nil {
		if err := c.meterProvider.Shutdown(ctx); err != nil {
			log.Fatal(err)
		}
	}
}
