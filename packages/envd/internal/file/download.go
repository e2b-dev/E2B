package file

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"go.uber.org/zap"
)

func Download(logger *zap.SugaredLogger, w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		http.Error(w, "File path is required", http.StatusBadRequest)
		return
	}

	logger.Info("Attempting to download file:", filePath)

	file, err := os.Open(filePath)
	if err != nil {
		logger.Error("Error opening file:", err)
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}
	defer file.Close()

	fileHeader := make([]byte, 512)
	file.Read(fileHeader)
	fileContentType := http.DetectContentType(fileHeader)

	fileStat, _ := file.Stat()
	fileSize := strconv.FormatInt(fileStat.Size(), 10)

	w.Header().Set("Content-Disposition", "attachment; filename="+filepath.Base(filePath))
	w.Header().Set("Content-Type", fileContentType)
	w.Header().Set("Content-Length", fileSize)

	file.Seek(0, 0)
	io.Copy(w, file)
}
