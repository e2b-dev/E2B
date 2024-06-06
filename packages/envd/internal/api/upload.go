package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/user"
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

func (API) PutFilesPath(w http.ResponseWriter, r *http.Request, path FilePath, params PutFilesPathParams) {
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
		func() {
			part, partErr := f.NextPart()
			defer part.Close()

			if partErr == io.EOF {
				// We're done reading the parts.
				return
			} else if partErr != nil {
				errMsg := fmt.Errorf("error reading form: %w", partErr)
				jsonError(w, http.StatusInternalServerError, errMsg)

				return
			}

			if part.FormName() == "file" {
				var pathToResolve string

				if path != "" {
					pathToResolve = path
				} else {
					pathToResolve = part.FileName()
				}

				resolvedPath, err := permissions.ExpandAndResolve(pathToResolve, u)
				if err != nil {
					errMsg := fmt.Errorf("error resolving path: %w", err)
					jsonError(w, http.StatusBadRequest, errMsg)

					return
				}

				freeSpace, err := freeDiskSpace(resolvedPath)
				if err != nil {
					errMsg := fmt.Errorf("error checking free disk space: %w", err)
					jsonError(w, http.StatusInternalServerError, errMsg)

					return
				}

				if freeSpace < uint64(r.ContentLength) {
					errMsg := fmt.Errorf("not enough disk space on '%s': %d bytes required, %d bytes free", resolvedPath, r.ContentLength, freeSpace)
					jsonError(w, http.StatusInsufficientStorage, errMsg)

					return
				}

				uid, gid, err := permissions.GetUserIds(u)
				if err != nil {
					errMsg := fmt.Errorf("error getting user ids: %w", err)
					jsonError(w, http.StatusInternalServerError, errMsg)

					return
				}

				err = permissions.EnsureDirs(resolvedPath, int(uid), int(gid))
				if err != nil {
					errMsg := fmt.Errorf("error ensuring directories: %w", err)
					jsonError(w, http.StatusInternalServerError, errMsg)

					return
				}

				file, err := os.Create(resolvedPath)
				if err != nil {
					errMsg := fmt.Errorf("error creating file: %w", err)
					jsonError(w, http.StatusInternalServerError, errMsg)

					return
				}
				defer file.Close()

				err = os.Chown(resolvedPath, int(uid), int(gid))
				if err != nil {
					errMsg := fmt.Errorf("error changing file ownership: %w", err)
					jsonError(w, http.StatusInternalServerError, errMsg)

					return
				}

				_, readErr := file.ReadFrom(part)
				if readErr != nil {
					errMsg := fmt.Errorf("error reading file: %w", readErr)
					jsonError(w, http.StatusInternalServerError, errMsg)

					return
				}
			}
		}()
	}
}
