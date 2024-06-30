package logs

import (
	"time"

	"github.com/rs/zerolog"
)

const (
	defaultMaxBufferSize = 2 << 15
	defaultTimeout       = 2 * time.Second
)

func LogBufferedDataEvents(dataCh <-chan []byte, logger *zerolog.Logger, eventType string) {
	timer := time.NewTicker(defaultTimeout)
	defer timer.Stop()

	var buffer []byte
	defer func() {
		if len(buffer) > 0 {
			logger.Debug().Str(eventType, string(buffer)).Send()
		}
	}()

	for {
		select {
		case <-timer.C:
			if len(buffer) > 0 {
				logger.Debug().Str(eventType, string(buffer)).Send()
				buffer = nil
			}
		case data, ok := <-dataCh:
			if !ok {
				return
			}

			buffer = append(buffer, data...)

			if len(buffer) >= defaultMaxBufferSize {
				logger.Debug().Str(eventType, string(buffer)).Send()
				buffer = nil

				continue
			}
		}
	}
}
