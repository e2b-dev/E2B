// Package api provides primitives to interact with the openapi HTTP API.
//
// Code generated by github.com/deepmap/oapi-codegen version v1.12.4 DO NOT EDIT.
package api

import (
	"bytes"
	"compress/gzip"
	"encoding/base64"
	"fmt"
	"net/url"
	"path"
	"strings"

	"github.com/getkin/kin-openapi/openapi3"
)

// Base64 encoded, gzipped, json marshaled Swagger object
var swaggerSpec = []string{

	"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",
	"//8+H/u8gSEAAA==",
}

// GetSwagger returns the content of the embedded swagger specification file
// or error if failed to decode
func decodeSpec() ([]byte, error) {
	zipped, err := base64.StdEncoding.DecodeString(strings.Join(swaggerSpec, ""))
	if err != nil {
		return nil, fmt.Errorf("error base64 decoding spec: %s", err)
	}
	zr, err := gzip.NewReader(bytes.NewReader(zipped))
	if err != nil {
		return nil, fmt.Errorf("error decompressing spec: %s", err)
	}
	var buf bytes.Buffer
	_, err = buf.ReadFrom(zr)
	if err != nil {
		return nil, fmt.Errorf("error decompressing spec: %s", err)
	}

	return buf.Bytes(), nil
}

var rawSpec = decodeSpecCached()

// a naive cached of a decoded swagger spec
func decodeSpecCached() func() ([]byte, error) {
	data, err := decodeSpec()
	return func() ([]byte, error) {
		return data, err
	}
}

// Constructs a synthetic filesystem for resolving external references when loading openapi specifications.
func PathToRawSpec(pathToFile string) map[string]func() ([]byte, error) {
	var res = make(map[string]func() ([]byte, error))
	if len(pathToFile) > 0 {
		res[pathToFile] = rawSpec
	}

	return res
}

// GetSwagger returns the Swagger specification corresponding to the generated code
// in this file. The external references of Swagger specification are resolved.
// The logic of resolving external references is tightly connected to "import-mapping" feature.
// Externally referenced files must be embedded in the corresponding golang packages.
// Urls can be supported but this task was out of the scope.
func GetSwagger() (swagger *openapi3.T, err error) {
	var resolvePath = PathToRawSpec("")

	loader := openapi3.NewLoader()
	loader.IsExternalRefsAllowed = true
	loader.ReadFromURIFunc = func(loader *openapi3.Loader, url *url.URL) ([]byte, error) {
		var pathToFile = url.String()
		pathToFile = path.Clean(pathToFile)
		getSpec, ok := resolvePath[pathToFile]
		if !ok {
			err1 := fmt.Errorf("path not found: %s", pathToFile)
			return nil, err1
		}
		return getSpec()
	}
	var specData []byte
	specData, err = rawSpec()
	if err != nil {
		return
	}
	swagger, err = loader.LoadFromData(specData)
	if err != nil {
		return
	}
	return
}
