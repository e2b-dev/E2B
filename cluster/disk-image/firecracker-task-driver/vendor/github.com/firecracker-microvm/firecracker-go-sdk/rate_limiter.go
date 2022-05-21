// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"). You may
// not use this file except in compliance with the License. A copy of the
// License is located at
//
//	http://aws.amazon.com/apache2.0/
//
// or in the "license" file accompanying this file. This file is distributed
// on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
// express or implied. See the License for the specific language governing
// permissions and limitations under the License.

package firecracker

import (
	"time"

	models "github.com/firecracker-microvm/firecracker-go-sdk/client/models"
)

// RateLimiterOpt represents a functional option for rate limiting construction
type RateLimiterOpt func(*models.RateLimiter)

// NewRateLimiter will construct a new RateLimiter with given parameters.
func NewRateLimiter(bandwidth, ops models.TokenBucket, opts ...RateLimiterOpt) *models.RateLimiter {
	limiter := &models.RateLimiter{
		Bandwidth: &bandwidth,
		Ops:       &ops,
	}

	for _, opt := range opts {
		opt(limiter)
	}

	return limiter
}

// TokenBucketBuilder is a builder that allows of building components of the
// models.RateLimiter structure.
type TokenBucketBuilder struct {
	bucket models.TokenBucket
}

// WithBucketSize will set the bucket size for the given token bucket
func (b TokenBucketBuilder) WithBucketSize(size int64) TokenBucketBuilder {
	b.bucket.Size = &size

	return b
}

// WithRefillDuration will set the given refill duration of the bucket fill rate.
func (b TokenBucketBuilder) WithRefillDuration(dur time.Duration) TokenBucketBuilder {
	ms := dur.Nanoseconds()
	ms /= int64(time.Millisecond)
	b.bucket.RefillTime = &ms

	return b
}

// WithInitialSize will set the initial token bucket size
func (b TokenBucketBuilder) WithInitialSize(size int64) TokenBucketBuilder {
	b.bucket.OneTimeBurst = &size

	return b
}

// Build will return a new token bucket
func (b TokenBucketBuilder) Build() models.TokenBucket {
	return b.bucket
}
