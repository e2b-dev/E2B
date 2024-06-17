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

	"github.com/e2b-dev/infra/packages/envd/internal/logs"
	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
	"github.com/rs/zerolog"
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

func processFile(r *http.Request, params PostFilesParams, part *multipart.Part, user *user.User, logger *zerolog.Event) (int, error) {
	var pathToResolve string

	if params.Path != nil {
		pathToResolve = *params.Path
	} else {
		pathToResolve = part.FileName()
	}

	logger.
		Str("path", pathToResolve).
		Msg("process file")

	resolvedPath, err := permissions.ExpandAndResolve(pathToResolve, user)
	if err != nil {
		errMsg := fmt.Errorf("error resolving path: %w", err)

		return http.StatusNotFound, errMsg
	}

	uid, gid, err := permissions.GetUserIds(user)
	if err != nil {
		errMsg := fmt.Errorf("error getting user ids: %w", err)

		return http.StatusInternalServerError, errMsg
	}

	err = permissions.EnsureDirs(filepath.Dir(resolvedPath), int(uid), int(gid))
	if err != nil {
		errMsg := fmt.Errorf("error ensuring directories: %w", err)

		return http.StatusInternalServerError, errMsg
	}

	freeSpace, err := freeDiskSpace(filepath.Dir(resolvedPath))
	if err != nil {
		errMsg := fmt.Errorf("error checking free disk space: %w", err)

		return http.StatusInternalServerError, errMsg
	}

	if freeSpace < uint64(r.ContentLength) {
		errMsg := fmt.Errorf("not enough disk space on '%s': %d bytes required, %d bytes free", filepath.Dir(resolvedPath), r.ContentLength, freeSpace)

		return http.StatusInsufficientStorage, errMsg
	}

	stat, err := os.Stat(resolvedPath)
	if err != nil && !os.IsNotExist(err) {
		errMsg := fmt.Errorf("error getting file info: %w", err)

		return http.StatusInternalServerError, errMsg
	}

	if err == nil {
		if stat.IsDir() {
			errMsg := fmt.Errorf("path is a directory: %s", resolvedPath)

			return http.StatusPreconditionFailed, errMsg
		}
	}

	file, err := os.Create(resolvedPath)
	if err != nil {
		errMsg := fmt.Errorf("error creating file: %w", err)

		return http.StatusInternalServerError, errMsg
	}

	defer file.Close()

	err = os.Chown(resolvedPath, int(uid), int(gid))
	if err != nil {
		errMsg := fmt.Errorf("error changing file ownership: %w", err)

		return http.StatusInternalServerError, errMsg
	}

	_, readErr := file.ReadFrom(part)
	if readErr != nil {
		errMsg := fmt.Errorf("error reading file: %w", readErr)

		return http.StatusInternalServerError, errMsg
	}

	return http.StatusNoContent, nil
}

func (a *API) PostFiles(w http.ResponseWriter, r *http.Request, params PostFilesParams) {
	defer r.Body.Close()

	var errorCode int

	var errMsg error

	var path string
	if params.Path != nil {
		path = *params.Path
	}

	requestID := logs.AssignRequestID()

	defer func() {
		l := a.logger.
			Err(errMsg).
			Int("error_code", errorCode).
			Str("method", r.Method+" "+r.URL.Path).
			Str(string(logs.RequestIDKey), logs.AssignRequestID()).
			Str("path", path).
			Str("username", params.Username)

		if errMsg != nil {
			l = l.Int("error_code", errorCode)
		}

		l.Msg("upload file")
	}()

	f, err := r.MultipartReader()
	if err != nil {
		errMsg = fmt.Errorf("error parsing multipart form: %w", err)
		errorCode = http.StatusInternalServerError
		jsonError(w, errorCode, errMsg)

		return
	}

	u, err := user.Lookup(params.Username)
	if err != nil {
		errMsg = fmt.Errorf("error looking up user '%s': %w", params.Username, err)
		errorCode = http.StatusBadRequest

		jsonError(w, errorCode, errMsg)

		return
	}

	for {
		part, partErr := f.NextPart()

		if partErr == io.EOF {
			// We're done reading the parts.
			break
		} else if partErr != nil {
			errMsg = fmt.Errorf("error reading form: %w", partErr)
			errorCode = http.StatusInternalServerError
			jsonError(w, errorCode, errMsg)

			break
		}

		if part.FormName() == "file" {
			status, processErr := processFile(r, params, part, u, a.logger.Trace().Str(string(logs.RequestIDKey), requestID))
			if processErr != nil {
				errorCode = status
				errMsg = processErr

				jsonError(w, errorCode, errMsg)

				return
			}
		}

		part.Close()
	}

	w.WriteHeader(http.StatusNoContent)
}
