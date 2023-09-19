package telemetry

// import (
// 	"io"

// 	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
// 	"go.opentelemetry.io/otel/sdk/resource"
// 	"go.opentelemetry.io/otel/sdk/trace"
// 	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
// )

// func NewExporter(w io.Writer) (trace.SpanExporter, error) {
// 	return stdouttrace.New(
// 		stdouttrace.WithWriter(w),
// 		// Use human-readable output.
// 		stdouttrace.WithPrettyPrint(),
// 		// Do not print timestamps for the demo.
// 		stdouttrace.WithoutTimestamps(),
// 	)
// }

// // newResource returns a resource describing this application.
// func NewResource(serviceName string) *resource.Resource {
// 	r, _ := resource.Merge(
// 		resource.Default(),
// 		resource.NewWithAttributes(
// 			semconv.SchemaURL,
// 			semconv.ServiceName(serviceName),
// 			semconv.ServiceVersion("v0.1.0"),
// 		),
// 	)

// 	return r
// }
