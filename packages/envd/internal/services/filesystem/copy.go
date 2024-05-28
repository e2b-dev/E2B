package filesystem

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"syscall"

	"github.com/e2b-dev/infra/packages/envd/internal/services/permissions"
	v1 "github.com/e2b-dev/infra/packages/envd/internal/services/spec/envd/filesystem/v1"

	"connectrpc.com/connect"
)

func copyDirectory(scrDir, dest string, mode os.FileMode) error {
	entries, err := os.ReadDir(scrDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		sourcePath := filepath.Join(scrDir, entry.Name())
		destPath := filepath.Join(dest, entry.Name())

		fileInfo, err := os.Stat(sourcePath)
		if err != nil {
			return err
		}

		stat, ok := fileInfo.Sys().(*syscall.Stat_t)
		if !ok {
			return fmt.Errorf("failed to get raw syscall.Stat_t data for '%s'", sourcePath)
		}

		switch fileInfo.Mode() & os.ModeType {
		case os.ModeDir:
			if err := createIfNotExists(destPath, mode); err != nil {
				return err
			}
			if err := copyDirectory(sourcePath, destPath, mode); err != nil {
				return err
			}
		case os.ModeSymlink:
			if err := CopySymLink(sourcePath, destPath); err != nil {
				return err
			}
		default:
			if err := copy(sourcePath, destPath); err != nil {
				return err
			}
		}

		if err := os.Lchown(destPath, int(stat.Uid), int(stat.Gid)); err != nil {
			return err
		}

		fInfo, err := entry.Info()
		if err != nil {
			return err
		}

		isSymlink := fInfo.Mode()&os.ModeSymlink != 0
		if !isSymlink {
			if err := os.Chmod(destPath, fInfo.Mode()); err != nil {
				return err
			}
		}
	}

	return nil
}

func copy(srcFile, dstFile string) error {
	out, err := os.Create(dstFile)
	if err != nil {
		return err
	}

	defer out.Close()

	in, err := os.Open(srcFile)
	if err != nil {
		return err
	}

	defer in.Close()

	_, err = io.Copy(out, in)
	if err != nil {
		return err
	}

	return nil
}

func exists(filePath string) bool {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return false
	}

	return true
}

func createIfNotExists(dir string, perm os.FileMode) error {
	if exists(dir) {
		return nil
	}

	if err := os.MkdirAll(dir, perm); err != nil {
		return fmt.Errorf("failed to create directory: '%s', error: '%s'", dir, err.Error())
	}

	return nil
}

func CopySymLink(source, dest string) error {
	link, err := os.Readlink(source)
	if err != nil {
		return fmt.Errorf("failed to read symlink: '%s', error: '%s'", source, err.Error())
	}

	return os.Symlink(link, dest)
}

func (Service) Copy(ctx context.Context, req *connect.Request[v1.CopyRequest]) (*connect.Response[v1.CopyResponse], error) {
	source := req.Msg.GetSource()
	destination := req.Msg.GetDestination()

	fileInfo, err := os.Stat(source)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("source not found: %w", err))
		}

		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error statting source file: %w", err))
	}

	stat, ok := fileInfo.Sys().(*syscall.Stat_t)
	if !ok {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to get raw syscall.Stat_t data for '%s'", source))
	}

	mode, err := permissions.GetMode(req.Msg.GetMode())
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid mode: %w", err))
	}

	switch fileInfo.Mode() & os.ModeType {
	case os.ModeDir:
		err = copyDirectory(source, destination, mode)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error copying directory: %w", err))
		}
	case os.ModeSymlink:
		if err = CopySymLink(source, destination); err != nil {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error copying symlink: %w", err))
		}
	default:
		if err := copy(source, destination); err != nil {
			return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error copying file: %w", err))
		}
	}

	err = os.Chown(destination, int(stat.Uid), int(stat.Gid))
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("error setting owner: %w", err))
	}

	return connect.NewResponse(&v1.CopyResponse{}), nil
}
