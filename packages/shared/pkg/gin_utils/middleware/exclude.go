package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

func ExcludeRoutes(middleware gin.HandlerFunc, notlogged ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		if !shouldSkip(path, notlogged) {
			middleware(c)
		} else {
			c.Next()
		}
	}
}

func IncludeRoutes(middleware gin.HandlerFunc, included ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		if shouldInclude(path, included) {
			middleware(c)
		} else {
			c.Next()
		}
	}
}

func shouldInclude(path string, patterns []string) bool {
	for _, pattern := range patterns {
		if matchPattern(path, pattern) {
			return true
		}
	}
	return false
}

func shouldSkip(path string, patterns []string) bool {
	for _, pattern := range patterns {
		if matchPattern(path, pattern) {
			return true
		}
	}

	return false
}

func matchPattern(path, pattern string) bool {
	pathSegments := strings.Split(path, "/")
	patternSegments := strings.Split(pattern, "/")

	if len(pathSegments) != len(patternSegments) {
		return false
	}

	for i := range pathSegments {
		if patternSegments[i] != pathSegments[i] && !strings.HasPrefix(patternSegments[i], ":") {
			return false
		}
	}

	return true
}
