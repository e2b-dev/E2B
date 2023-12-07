package metrics

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	semconv "go.opentelemetry.io/otel/semconv/v1.7.0"
)

// Middleware returns middleware that will trace incoming requests.
// The service parameter should describe the name of the (virtual)
// server handling the request.
func Middleware(service string, options ...Option) gin.HandlerFunc {
	cfg := defaultConfig()
	for _, option := range options {
		option.apply(cfg)
	}
	recorder := cfg.recorder
	if recorder == nil {
		recorder = GetRecorder("")
	}
	return func(ginCtx *gin.Context) {
		ctx := ginCtx.Request.Context()

		route := ginCtx.FullPath()
		if len(route) <= 0 {
			route = "nonconfigured"
		}
		if !cfg.shouldRecord(service, route, ginCtx.Request) {
			ginCtx.Next()
			return
		}

		start := time.Now()
		reqAttributes := cfg.attributes(service, route, ginCtx.Request)

		if cfg.recordInFlight {
			recorder.AddInflightRequests(ctx, 1, reqAttributes)
			defer recorder.AddInflightRequests(ctx, -1, reqAttributes)
		}

		defer func() {
			resAttributes := append(reqAttributes[0:0], reqAttributes...)

			if cfg.groupedStatus {
				code := int(ginCtx.Writer.Status()/100) * 100
				resAttributes = append(resAttributes, semconv.HTTPStatusCodeKey.Int(code))
			} else {
				resAttributes = append(resAttributes, semconv.HTTPAttributesFromHTTPStatusCode(ginCtx.Writer.Status())...)
			}

			recorder.AddRequests(ctx, 1, resAttributes)

			if cfg.recordSize {
				requestSize := computeApproximateRequestSize(ginCtx.Request)
				recorder.ObserveHTTPRequestSize(ctx, requestSize, resAttributes)
				recorder.ObserveHTTPResponseSize(ctx, int64(ginCtx.Writer.Size()), resAttributes)
			}

			if cfg.recordDuration {
				recorder.ObserveHTTPRequestDuration(ctx, time.Since(start), resAttributes)
			}
		}()

		ginCtx.Next()
	}
}

func computeApproximateRequestSize(r *http.Request) int64 {
	s := 0
	if r.URL != nil {
		s = len(r.URL.Path)
	}

	s += len(r.Method)
	s += len(r.Proto)
	for name, values := range r.Header {
		s += len(name)
		for _, value := range values {
			s += len(value)
		}
	}
	s += len(r.Host)

	// N.B. r.Form and r.MultipartForm are assumed to be included in r.URL.

	if r.ContentLength != -1 {
		s += int(r.ContentLength)
	}
	return int64(s)
}
