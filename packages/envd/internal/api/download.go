package api

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/user"
	"time"

	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
)

func (API) GetFilesPath(w http.ResponseWriter, r *http.Request, path FilePath, params GetFilesPathParams) {
	defer r.Body.Close()

	u, err := user.Lookup(params.Username)
	if err != nil {
		errMsg := fmt.Errorf("error looking up user '%s': %v", params.Username, err)
		jsonError(w, http.StatusBadRequest, errMsg)

		return
	}

	resolvedPath, err := permissions.ExpandAndResolve(path, u)
	if err != nil {
		errMsg := fmt.Errorf("error expanding and resolving path '%s': %v", path, err)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return
	}

	stat, err := os.Stat(resolvedPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			errMsg := fmt.Errorf("path '%s' does not exist", resolvedPath)
			jsonError(w, http.StatusNotFound, errMsg)

			return
		}

		errMsg := fmt.Errorf("error checking if path exists '%s': %v", resolvedPath, err)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return
	}

	if stat.IsDir() {
		errMsg := fmt.Errorf("path '%s' is a directory", resolvedPath)
		jsonError(w, http.StatusForbidden, errMsg)

		return
	}

	file, err := os.Open(resolvedPath)
	if err != nil {
		errMsg := fmt.Errorf("error opening file '%s': %v", resolvedPath, err)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return
	}
	defer file.Close()

	http.ServeContent(w, r, path, time.Now(), file)
}
