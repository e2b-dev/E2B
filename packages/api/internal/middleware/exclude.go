package middleware

import (
	"github.com/gin-gonic/gin"
)

func ExcludeRoutes(middleware gin.HandlerFunc, notlogged ...string) gin.HandlerFunc {
	var skip map[string]struct{}

	if length := len(notlogged); length > 0 {
		skip = make(map[string]struct{}, length)

		for _, path := range notlogged {
			skip[path] = struct{}{}
		}
	}

	return func(c *gin.Context) {
		path := c.Request.URL.Path

		if _, ok := skip[path]; !ok {
			middleware(c)
		} else {
			c.Next()
		}
	}
}
