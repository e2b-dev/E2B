package process

import (
	"fmt"
	"os"
)

func adjustOomScore(pid, score int) error {
	oomScoreAdjPath := fmt.Sprintf("/proc/%d/oom_score_adj", pid)

	_, err := os.Stat(oomScoreAdjPath)
	if os.IsNotExist(err) {
		return fmt.Errorf("OOM score file does not exist for process '%d'", pid)
	}

	err = os.WriteFile(oomScoreAdjPath, []byte(fmt.Sprintf("%d", score)), 0o644)
	if err != nil {
		return fmt.Errorf("failed to set OOM score adjust for process '%d': %w", pid, err)
	}

	return nil
}
