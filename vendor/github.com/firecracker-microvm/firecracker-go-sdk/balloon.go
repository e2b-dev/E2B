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
	models "github.com/firecracker-microvm/firecracker-go-sdk/client/models"
)

// BalloonDevice is a builder that will create a balloon used to set up
// the firecracker microVM.
type BalloonDevice struct {
	balloon models.Balloon
}

type BalloonOpt func(*models.Balloon)

// NewBalloonDevice will return a new BalloonDevice.
func NewBalloonDevice(amountMib int64, deflateOnOom bool, opts ...BalloonOpt) BalloonDevice {
	b := models.Balloon{
		AmountMib:     &amountMib,
		DeflateOnOom: &deflateOnOom,
	}

	for _, opt := range opts {
		opt(&b)
	}

	return BalloonDevice{balloon: b}
}

// Build will return a new balloon
func (b BalloonDevice) Build() models.Balloon {
	return b.balloon
}

// WithStatsPollingIntervals is a functional option which sets the time in seconds between refreshing statistics.
func WithStatsPollingIntervals(statsPollingIntervals int64) BalloonOpt {
	return func(d *models.Balloon) {
		d.StatsPollingIntervals = statsPollingIntervals
	}
}

// UpdateAmountMiB sets the target size of the balloon
func (b BalloonDevice) UpdateAmountMib(amountMib int64) BalloonDevice {
	b.balloon.AmountMib = &amountMib
	return b
}

// UpdateStatsPollingIntervals sets the time in seconds between refreshing statistics.
// A non-zero value will enable the statistics. Defaults to 0.
func (b BalloonDevice) UpdateStatsPollingIntervals(statsPollingIntervals int64) BalloonDevice {
	b.balloon.StatsPollingIntervals = statsPollingIntervals
	return b
}
