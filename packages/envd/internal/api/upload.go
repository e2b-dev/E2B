package api

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"os/user"
	"path/filepath"
	"syscall"

	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
)

func freeDiskSpace(path string) (free uint64, err error) {
	var stat syscall.Statfs_t

	err = syscall.Statfs(path, &stat)
	if err != nil {
		return 0, fmt.Errorf("error getting free disk space: %w", err)
	}

	// Available blocks * size per block = available space in bytes
	freeSpace := stat.Bavail * uint64(stat.Bsize)

	return freeSpace, nil
}

func processFile(w http.ResponseWriter, r *http.Request, params PostFilesParams, part *multipart.Part, user *user.User) bool {
	var pathToResolve string

	if params.Path != nil {
		pathToResolve = *params.Path
	} else {
		pathToResolve = part.FileName()
	}

	resolvedPath, err := permissions.ExpandAndResolve(pathToResolve, user)
	if err != nil {
		errMsg := fmt.Errorf("error resolving path: %w", err)
		jsonError(w, http.StatusNotFound, errMsg)

		return false
	}

	uid, gid, err := permissions.GetUserIds(user)
	if err != nil {
		errMsg := fmt.Errorf("error getting user ids: %w", err)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return false
	}

	err = permissions.EnsureDirs(filepath.Dir(resolvedPath), int(uid), int(gid))
	if err != nil {
		errMsg := fmt.Errorf("error ensuring directories: %w", err)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return false
	}

	freeSpace, err := freeDiskSpace(filepath.Dir(resolvedPath))
	if err != nil {
		errMsg := fmt.Errorf("error checking free disk space: %w", err)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return false
	}

	if freeSpace < uint64(r.ContentLength) {
		errMsg := fmt.Errorf("not enough disk space on '%s': %d bytes required, %d bytes free", filepath.Dir(resolvedPath), r.ContentLength, freeSpace)
		jsonError(w, http.StatusInsufficientStorage, errMsg)

		return false
	}

	stat, err := os.Stat(resolvedPath)
	if err != nil && !os.IsNotExist(err) {
		errMsg := fmt.Errorf("error getting file info: %w", err)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return false
	}

	if err == nil {
		if stat.IsDir() {
			errMsg := fmt.Errorf("path is a directory: %s", resolvedPath)
			jsonError(w, http.StatusPreconditionFailed, errMsg)

			return false
		}
	}

	file, err := os.Create(resolvedPath)
	if err != nil {
		errMsg := fmt.Errorf("error creating file: %w", err)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return false
	}
	defer file.Close()

	err = os.Chown(resolvedPath, int(uid), int(gid))
	if err != nil {
		errMsg := fmt.Errorf("error changing file ownership: %w", err)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return false
	}

	_, readErr := file.ReadFrom(part)
	if readErr != nil {
		errMsg := fmt.Errorf("error reading file: %w", readErr)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return false
	}

	return true
}

func (a *API) PostFiles(w http.ResponseWriter, r *http.Request, params PostFilesParams) {
	var err error

	defer a.logger.Err(err).Msg("uploading file")

	defer r.Body.Close()

	f, err := r.MultipartReader()
	if err != nil {
		errMsg := fmt.Errorf("error parsing multipart form: %w", err)
		jsonError(w, http.StatusInternalServerError, errMsg)

		return
	}

	u, err := user.Lookup(params.Username)
	if err != nil {
		errMsg := fmt.Errorf("error looking up user '%s': %w", params.Username, err)
		jsonError(w, http.StatusBadRequest, errMsg)

		return
	}

	for {
		part, partErr := f.NextPart()

		if partErr == io.EOF {
			// We're done reading the parts.
			break
		} else if partErr != nil {
			errMsg := fmt.Errorf("error reading form: %w", partErr)
			jsonError(w, http.StatusInternalServerError, errMsg)

			break
		}

		if part.FormName() == "file" {
			ok := processFile(w, r, params, part, u)
			if !ok {
				return
			}
		}

		part.Close()
	}

	w.WriteHeader(http.StatusNoContent)
}
