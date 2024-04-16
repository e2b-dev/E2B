package utils

import (
	"fmt"

	"github.com/gogo/status"
)

func UnwrapGRPCError(err error) error {
	if err == nil {
		return nil
	}

	st, ok := status.FromError(err)
	if !ok {
		return err
	}

	return fmt.Errorf("[%s] %s", st.Code(), st.Message())
}
