package file

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path"

	"github.com/e2b-dev/infra/packages/envd/internal/user"

	"go.uber.org/zap"
)

const maxFileInMemory = 512 * 1024 * 1024 // 512MB

func Upload(logger *zap.SugaredLogger, w http.ResponseWriter, r *http.Request) {
	logger.Debug(
		"Starting file upload",
	)

	if err := r.ParseMultipartForm(maxFileInMemory); err != nil {
		logger.Error("Error parsing multipart form:", err)
		http.Error(w, fmt.Sprintf("The uploaded file is too big. Please choose an file that's less than 100MB in size: %s", err.Error()), http.StatusBadRequest)

		return
	}

	logger.Debug("Multipart form parsed successfully")

	// The argument to FormFile must match the name attribute
	// of the file input on the frontend
	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		logger.Error("Error retrieving the file from form-data:", err)
		http.Error(w, err.Error(), http.StatusBadRequest)

		return
	}

	logger.Debug("File retrieved successfully")

	defer func() {
		closeErr := file.Close()
		if closeErr != nil {
			logger.Error("Error closing file:", closeErr)
		}
	}()

	filepath := r.Form.Get("path")

	var newFilePath string

	if filepath == "" {
		// Create a new file in the user's homedir if no path in the form is specified
		_, _, homedir, _, userErr := user.GetUser(user.DefaultUser)
		if userErr != nil {
			logger.Panic("Error getting user home dir:", userErr)
			http.Error(w, userErr.Error(), http.StatusInternalServerError)

			return
		}

		newFilePath = path.Join(homedir, fileHeader.Filename)
	} else {
		newFilePath = filepath
	}

	logger.Debugw(
		"Starting file upload",
		"path", newFilePath,
	)

	dst, err := os.Create(newFilePath)
	if err != nil {
		logger.Error("Error creating the file:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}

	logger.Debugw("File created successfully",
		"path", newFilePath,
	)

	logger.Debugw("File created successfully")

	defer func() {
		closeErr := dst.Close()
		if closeErr != nil {
			logger.Error("Error closing file:", closeErr)
		}
	}()

	pr := &Progress{
		TotalSize: fileHeader.Size,
	}

	// Copy the uploaded file to the filesystem
	// at the specified destination
	_, err = io.Copy(dst, io.TeeReader(file, pr))
	if err != nil {
		logger.Error("Error saving file to filesystem:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)

		return
	}

	logger.Info("Upload complete ", "path", newFilePath)
}
