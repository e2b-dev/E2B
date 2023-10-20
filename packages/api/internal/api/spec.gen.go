// Package api provides primitives to interact with the openapi HTTP API.
//
// Code generated by github.com/deepmap/oapi-codegen version v1.15.0 DO NOT EDIT.
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

	"H4sIAAAAAAAC/8xY32/buA//VwR9v49unXW9l7y1W28XbNiKdcAdUAQHxaZjbbbkSXS6oPD/fqDkn7GT",
	"NNs67KlpRJEi+eGHZB55pPNCK1Bo+fyRF8KIHBCM+29VyixevKaPUvE5LwSmPOBK5MDn7WnADXwtpYGY",
	"z9GUEHAbpZALuobbgkQtGqnWvKoCDmqzV6M/O02fVBaFimCv0p7AKZorEraFVhZcLC5nM/oTaYWgkD6K",
	"oshkJFBqFX62WtF3nb7/G0j4nP8v7AIc+lMb3hijjbcRg42MLEgJn/NrETN6IljkVcAvZy+e3+ZViSko",
	"rLUy8HJk/PL5jb/XyBJdqpgs/vErQnwHZgOmcbNqIOByfKM20miV19YLowswKGG3GIYaFzGFL5FgmE4Y",
	"psCcKA92MdUD/zEN0HvJhJ5Mr61Xk4gyQz6/X46gRG9gTjDgEiG3EyhvVQtjxJb+L8pVJqPxE/9OAVMw",
	"u49j0jJ/hWnDtMq2TEQRWCtXGbDV1skjiLzzYqV1BkKRMYsCSzs2due+n44FqDLn83ufDnKC6lTEWzpy",
	"OV0GEyzR1f19yzIdf9XvaL2vA7ysAu5xNAJDpGMYv9sJM3cW8ESbXKAjIHx50fkvFcIaXInlYK1Y71PE",
	"jzlSG2q00HMXNdlNvDiToPBp6POyPwvALDE6Zw+pjFKCC502nMwiAwJhslaGxH7MXiPNn5r9QVtog0Mx",
	"fA8P+8P45AA0Ng+X8uTjlo6WICqNxO0d0ZO3feUq65P+AopI25ESCAPmzwZqvvb+RRLhNbW5mnNinfkU",
	"saAYXxXyLWwbZa55piBiJ1q3z3/Orm4XZ29h290W7pYnV6kS7YhFYkZnNxfX7Op2wQO+AWN9cGbnL85n",
	"ZE4XoEQh+Zy/PJ+dz6jgBKbOtxDUxn1YA47D+05aZCLL+sGkeqXMuO6wiPmcvwG8IS07nfvixLbSkqXI",
	"sg8Jn98f6TS9/FbLEaVOdKDSZSkps2zLDGBpFMRj77r+P2W99TAkoa55HpYloT64nHMjWN0vKyJRQT3G",
	"YdJTYaHtRGpeuQpmgil42MH6MDu32nbpcSPOtY63O5nJywxlIQyGRJ9nsUDhqy7SjuybPvyKrnzD3u1P",
	"DTa71OoIAc8sGuo/Xavf09p7KocevtbRFzC+qbOolurx+0oqYbZTFBa7m4nMYJ9WOmON/yfw7esJng18",
	"/y0MWNeZx0RsU11mMVsRO5E7xwlpEJmBQ12b1avPEGEzMvfn62pUiRc/b8Drl924yD41YxhLhWUWhaE2",
	"85vVVBV43gsfXZ6r0L3Yho/1aFLtJcQ3gMMxjGh4Dx/ekG43DtrrduTpL3p7CK4TCT0Mq+CoYDNTkegO",
	"ZFUM3xrUunxIta5TlOk1w1QMAVrz4oPEdGIMdL3qawmu8OpWRUPbhySxgLxf6+2QPBvPYJSUH2oWPwDR",
	"6T6w6+qJkK23tmOyl78FvMNmj5luLVdxzEQHkb0dZQzwd37teW6QLw+1ssO4GTYgUcg7iMxUpV/dLpj1",
	"ZwcWwacueDv03tltVp7vYvUXEytcH9wijsGn8NnQXE2iLwWR+dl2kkX/cscsSiH6MsWe/nzPPDlU9dHj",
	"gD1Qt2l9P81fF+uwWUwOFEYzc6lukXI71pgmxwWzaNV/P3gPkV5/e3o6eH6K6aHd8TzQBouSVG+evWRl",
	"W5+u2VPSNfuFs0RvSRvybAeV5RA64WO33lahgcSATQ8h6qMXGS7n8A1B0djNJFqGMgeGmmVyA4eRtWht",
	"f2wtn0rGvfV8okdfHiGcxuN4+NvAc7LP96TMXTObJiSlyerd3M7DUBTyHC5W5zFseE/D4+7v2ta1rO4X",
	"dEtb6H8BAAD//zBjcTnYFwAA",
}

// GetSwagger returns the content of the embedded swagger specification file
// or error if failed to decode
func decodeSpec() ([]byte, error) {
	zipped, err := base64.StdEncoding.DecodeString(strings.Join(swaggerSpec, ""))
	if err != nil {
		return nil, fmt.Errorf("error base64 decoding spec: %w", err)
	}
	zr, err := gzip.NewReader(bytes.NewReader(zipped))
	if err != nil {
		return nil, fmt.Errorf("error decompressing spec: %w", err)
	}
	var buf bytes.Buffer
	_, err = buf.ReadFrom(zr)
	if err != nil {
		return nil, fmt.Errorf("error decompressing spec: %w", err)
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
	res := make(map[string]func() ([]byte, error))
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
	resolvePath := PathToRawSpec("")

	loader := openapi3.NewLoader()
	loader.IsExternalRefsAllowed = true
	loader.ReadFromURIFunc = func(loader *openapi3.Loader, url *url.URL) ([]byte, error) {
		pathToFile := url.String()
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