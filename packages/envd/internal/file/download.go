package file

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"go.uber.org/zap"
)

const FileHeaderByteSize = 512

func Download(logger *zap.SugaredLogger, w http.ResponseWriter, r *http.Request) {
	logger.Debug("Starting file download")

	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		http.Error(w, "File path is required", http.StatusBadRequest)

		return
	}

	logger.Debugw(
		"Starting file download",
		"path", filePath,
	)

	file, err := os.Open(filePath)
	if err != nil {
		logger.Error("Error opening file:", err)
		http.Error(w, fmt.Sprintf("File not found: %s", err.Error()), http.StatusNotFound)

		return
	}

	logger.Debug("File opened successfully")

	defer func() {
		closeErr := file.Close()
		if closeErr != nil {
			logger.Error("Error closing file:", closeErr)
		}
	}()

	fileHeader := make([]byte, FileHeaderByteSize)

	_, err = file.Read(fileHeader)
	if err != nil {
		logger.Error("Error reading file header:", err)
		http.Error(w, fmt.Sprintf("Error reading file: %s", err.Error()), http.StatusInternalServerError)

		return
	}

	fileContentType := http.DetectContentType(fileHeader)

	fileStat, _ := file.Stat()
	fileSize := strconv.FormatInt(fileStat.Size(), 10)

	w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(filePath))
	w.Header().Set("Content-Type", fileContentType)
	w.Header().Set("Content-Length", fileSize)

	_, err = file.Seek(0, 0)
	if err != nil {
		logger.Error("Error seeking file:", err)
		http.Error(w, fmt.Sprintf("Error reading file: %s", err.Error()), http.StatusInternalServerError)

		return
	}

	_, err = io.Copy(w, file)
	if err != nil {
		logger.Error("Error copying file to response:", err)
		http.Error(w, fmt.Sprintf("Error reading file: %s", err.Error()), http.StatusInternalServerError)

		return
	}

	logger.Info("File download complete",
		"path", filePath,
	)
}
