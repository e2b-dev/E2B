package loki

import "strconv"

type Direction int32

const (
	FORWARD  Direction = 0
	BACKWARD Direction = 1
)

var Direction_name = map[int32]string{
	0: "FORWARD",
	1: "BACKWARD",
}

var Direction_value = map[string]int32{
	"FORWARD":  0,
	"BACKWARD": 1,
}

func (x Direction) String() string {
	s, ok := Direction_name[int32(x)]
	if ok {
		return s
	}
	return strconv.Itoa(int(x))
}
