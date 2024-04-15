package env

import (
	"archive/tar"
	"fmt"
	"io"
	"os"
)

func addFileToTarWriter(writer *tar.Writer, file fileToTar) error {
	f, err := os.Open(file.localPath)
	if err != nil {
		errMsg := fmt.Errorf("error opening file: %w", err)

		return errMsg
	}

	defer func() {
		closeErr := f.Close()
		if closeErr != nil {
			errMsg := fmt.Errorf("error closing file: %w", closeErr)
			fmt.Print(errMsg)
		}
	}()

	stat, err := f.Stat()
	if err != nil {
		errMsg := fmt.Errorf("error statting file: %w", err)

		return errMsg
	}

	hdr := &tar.Header{
		Name: file.tarPath, // The name of the file in the tar archive
		Mode: 0o777,
		Size: stat.Size(),
	}

	err = writer.WriteHeader(hdr)
	if err != nil {
		errMsg := fmt.Errorf("error writing tar header: %w", err)

		return errMsg
	}

	_, err = io.Copy(writer, f)
	if err != nil {
		errMsg := fmt.Errorf("error copying file to tar: %w", err)

		return errMsg
	}

	return nil
}

type fileToTar struct {
	localPath string
	tarPath   string
}
