package utils

const DefaultLimit = 2

func CreateLimitLock(limit int) func() func() {
	sem := make(chan struct{}, limit)
	acquire := func() { sem <- struct{}{} }
	release := func() { <-sem }

	lock := func() func() {
		acquire()

		return release
	}

	return lock
}
