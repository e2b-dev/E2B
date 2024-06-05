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

func checkFreeSpace(path string, size int64) (bool, error) {
	var stat syscall.Statfs_t

	err := syscall.Statfs(path, &stat)
	if err != nil {
		return false, fmt.Errorf("error getting free disk space: %w", err)
	}

	// Available blocks * size per block = available space in bytes
	freeSpace := stat.Bavail * uint64(stat.Bsize)

	return freeSpace >= uint64(size), nil
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
		errMsg := fmt.Errorf("error looking up user '%s': %v", params.Username, err)
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
					errMsg := fmt.Errorf("error resolving path: %v", err)
					jsonError(w, http.StatusBadRequest, errMsg)

					return
				}

				enoughSpace, err := checkFreeSpace(resolvedPath, r.ContentLength)
				if err != nil {
					errMsg := fmt.Errorf("error checking free disk space: %w", err)
					jsonError(w, http.StatusInternalServerError, errMsg)

					return
				}

				tmpFile, err := os.CreateTemp(os.TempDir(), fmt.Sprintf("%s-*", resolvedPath))
				if err != nil {
					errMsg := fmt.Errorf("error creating temp file: %w", err)
					jsonError(w, http.StatusInternalServerError, errMsg)

					return
				}
				defer os.Remove(tmpFile.Name())
				defer tmpFile.Close()

				_, readErr := tmpFile.ReadFrom(part)
				if readErr != nil {
					errMsg := fmt.Errorf("error reading file: %w", readErr)
					jsonError(w, http.StatusInternalServerError, errMsg)

					return
				}

			}
		}()
	}

	var newFilePath string

	if filepath != "" {
		newFilePath = filepath
	} else if filename != "" {
		// Create a new file in the user's homedir if no path in the form is specified
		_, _, homedir, _, userErr := user.GetUser(user.DefaultUser)
		if userErr != nil {
			logger.Panic("Error getting user home dir:", userErr)
			http.Error(w, userErr.Error(), http.StatusInternalServerError)

			return
		}
		newFilePath = path.Join(homedir, filename)
	} else {
		logger.Error("No file or path provided")
		http.Error(w, "No file or path provided", http.StatusBadRequest)

		return
	}

	err = os.Rename(tmpFile.Name(), newFilePath)
	if err != nil {
		logger.Error("Error renaming file:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}

	err = os.Chmod(newFilePath, 0o666)
	if err != nil {
		logger.Error("Error setting file permissions:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}
}
