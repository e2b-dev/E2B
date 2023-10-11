package file

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path"

	"go.uber.org/zap"
)

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024 // 100MB

func Upload(logger *zap.SugaredLogger, w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, MAX_UPLOAD_SIZE)

	if err := r.ParseMultipartForm(MAX_UPLOAD_SIZE); err != nil {
		logger.Error("Error parsing multipart form:", err)
		http.Error(w, "The uploaded file is too big. Please choose an file that's less than 100MB in size", http.StatusBadRequest)
		return
	}

	// The argument to FormFile must match the name attribute
	// of the file input on the frontend
	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		logger.Error("Error retrieving the file from form-data:", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	defer file.Close()

	// Create a new file in the uploads directory
	homedir, err := os.UserHomeDir()
	if err != nil {
		logger.Panic("Error getting user home dir:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	newFilePath := path.Join(homedir, fileHeader.Filename)

	dst, err := os.Create(newFilePath)
	if err != nil {
		logger.Error("Error creating the file:", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	defer dst.Close()

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

	fmt.Fprintf(w, "Upload successful")
}
