package firecracker

// BoolValue will return a boolean value. If the pointer is nil, then false
// will be returned.
func BoolValue(b *bool) bool {
	if b == nil {
		return false
	}

	return *b
}

// Bool will return a pointer value of the given parameter.
func Bool(b bool) *bool {
	return &b
}

// StringValue will return a string value. If the pointer is nil, then an empty
// string will be returned.
func StringValue(str *string) string {
	if str == nil {
		return ""
	}

	return *str
}

// String will return a pointer value of the given parameter.
func String(str string) *string {
	return &str
}

// Int64 will return a pointer value of the given parameter.
func Int64(v int64) *int64 {
	return &v
}

// Int64Value will return an int64 value. If the pointer is nil, then zero will
// be returned.
func Int64Value(v *int64) int64 {
	if v == nil {
		return 0
	}

	return *v
}

// IntValue will return an int value. If the pointer is nil, zero will be
// returned.
func IntValue(v *int) int {
	if v == nil {
		return 0
	}

	return *v
}

// Int will return a pointer value of the given parameters.
func Int(v int) *int {
	return &v
}
