package file

import (
	"bufio"
	"bytes"
	"io"
	"net/http"
	"os"
	"path"

	"github.com/e2b-dev/infra/packages/envd/internal/user"

	"go.uber.org/zap"
)

const (
	uploadBuffer = 16 * 1024 * 1024
)

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

	tmpFile, err := os.CreateTemp(os.TempDir(), "envd-upload")
	if err != nil {
		logger.Error("Error creating temp file:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}
	defer os.Remove(tmpFile.Name())

	closeErr := tmpFile.Close()
	if closeErr != nil {
		logger.Error("Error closing file:", closeErr)
		http.Error(w, closeErr.Error(), http.StatusInternalServerError)

		return
	}

	file, err := os.OpenFile(tmpFile.Name(), os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		logger.Error("Error opening file:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}
	defer file.Close()

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

			r := bufio.NewReaderSize(part, uploadBuffer)

			_, err = r.WriteTo(file)
			if err != nil {
				part.Close()
				logger.Error("Error copying file to temp file:", err)
				http.Error(w, err.Error(), http.StatusInternalServerError)

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
		}

		part.Close()
	}

	var newFilePath string

	if filepath == "" {
		// Create a new file in the user's homedir if no path in the form is specified
		_, _, homedir, _, userErr := user.GetUser(user.DefaultUser)
		if userErr != nil {
			logger.Panic("Error getting user home dir:", userErr)
			http.Error(w, userErr.Error(), http.StatusInternalServerError)

			return
		}

		newFilePath = path.Join(homedir, filename)
	} else {
		newFilePath = filepath
	}

	logger.Debugw("New file path", "path", newFilePath, "filepath", filepath)

	err = os.Rename(file.Name(), newFilePath)
	if err != nil {
		logger.Error("Error renaming file:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}

	logger.Info("Upload complete ", "path", newFilePath)
}
