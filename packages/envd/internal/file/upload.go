package file

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"syscall"

	"github.com/e2b-dev/infra/packages/envd/internal/user"

	"go.uber.org/zap"
)

func getFreeDiskSpace(path string) (uint64, error) {
	var stat syscall.Statfs_t

	err := syscall.Statfs(path, &stat)
	if err != nil {
		return 0, fmt.Errorf("error getting free disk space: %w", err)
	}

	// Available blocks * size per block = available space in bytes
	freeSpace := stat.Bavail * uint64(stat.Bsize)

	return freeSpace, nil
}

func Upload(logger *zap.SugaredLogger, w http.ResponseWriter, r *http.Request) {
	logger.Debug(
		"Starting file upload",
	)

	f, err := r.MultipartReader()
	if err != nil {
		logger.Error("Error parsing multipart form:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}
	defer r.Body.Close()

	tmpFreeSpace, err := getFreeDiskSpace(os.TempDir())
	if err != nil {
		logger.Error("Error getting free disk space:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}

	if tmpFreeSpace < uint64(r.ContentLength) {
		logger.Error("Not enough free disk space")
		http.Error(w, "Not enough free disk space", http.StatusInternalServerError)

		return
	}

	tmpFile, err := os.CreateTemp(os.TempDir(), "envd-upload")
	if err != nil {
		logger.Error("Error creating temp file:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	var filepath string

	var filename string

	for {
		// Get the next part.
		part, partErr := f.NextPart()

		logger.Debugw("Part", "part", partErr)

		if partErr == io.EOF {
			// We're done reading the parts.
			break
		} else if partErr != nil {
			logger.Error("Error reading form:", partErr)
			http.Error(w, partErr.Error(), http.StatusInternalServerError)

			return
		}

		// Get the key of the part.
		key := part.FormName()
		logger.Debugw("Part", "part key", key)

		if key == "file" {
			filename = part.FileName()

			_, readErr := tmpFile.ReadFrom(part)
			if readErr != nil {
				part.Close()
				logger.Error("Error reading file:", readErr)
				http.Error(w, readErr.Error(), http.StatusInternalServerError)

				return
			}
		} else if key == "path" {
			buf := new(bytes.Buffer)
			_, err = buf.ReadFrom(part)
			if err != nil {
				part.Close()
				logger.Error("Error reading file path:", err)
				http.Error(w, err.Error(), http.StatusInternalServerError)

				return
			}
			filepath = buf.String()
		} else {
			fmt.Printf("key not found: %s", key)
		}

		part.Close()
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

	logger.Debugw("New file path", "path", newFilePath, "filepath", filepath)

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

	logger.Infow("Upload complete", "path", newFilePath)
}
