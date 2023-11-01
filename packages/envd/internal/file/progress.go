package file

import "fmt"

const TotalPercent = 100

// Progress is used to track the progress of a file upload.
// It implements the io.Writer interface so it can be passed
// to an io.TeeReader()
type Progress struct {
	TotalSize int64
	BytesRead int64
}

// Write is used to satisfy the io.Writer interface.
// Instead of writing somewhere, it simply aggregates
// the total bytes on each read
func (pr *Progress) Write(p []byte) (n int, err error) {
	n, err = len(p), nil
	pr.BytesRead += int64(n)
	pr.PrintProgress()

	return
}

// PrintProgress displays the current progress of the file upload
func (pr *Progress) PrintProgress() {
	if pr.BytesRead == pr.TotalSize {
		fmt.Println("DONE!")

		return
	}

	pct := float64(pr.BytesRead) / float64(pr.TotalSize) * TotalPercent
	fmt.Printf("file upload progress: %.1f%%\n", pct)
}
