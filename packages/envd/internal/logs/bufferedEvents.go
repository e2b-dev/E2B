package logs

import (
	"bufio"
	"bytes"
	"fmt"
	"time"

	"github.com/rs/zerolog"
)

const (
	defaultMaxBufferSize = 2 << 15
	defaultTimeout       = 4 * time.Second
	startScanCapacity    = 2 << 12
)

func LogBufferedDataEvents(dataCh <-chan []byte, logger *zerolog.Event, eventType string) {
	timer := time.NewTimer(defaultTimeout)
	defer timer.Stop()

	var buffer []byte

	for {
		select {
		case data, ok := <-dataCh:
			if !ok {
				return
			}

			buffer = append(buffer, data...)

			if len(buffer) >= defaultMaxBufferSize {
				logger.Str(eventType, string(buffer)).Send()
				buffer = nil

				continue
			}

			scanner := bufio.NewScanner(bytes.NewReader(buffer))

			buf := make([]byte, 0, startScanCapacity)
			scanner.Buffer(buf, defaultMaxBufferSize)

			for scanner.Scan() {
				line := scanner.Text()

				logger.Str(eventType, line+"\n").Send()
			}

			if scanner.Err() == nil {
				buffer = scanner.Bytes() // Remaining data that doesn't end with a newline
			} else {
				fmt.Println("error", scanner.Err())
			}

		case <-timer.C:
			if len(buffer) > 0 {
				logger.Str(eventType, string(buffer)).Send()
				buffer = nil
			}
		}
	}
}
