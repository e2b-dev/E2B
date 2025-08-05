package main

import (
	"context"
	"fmt"
	"github.com/e2b-dev/e2b/packages/go-sdk/client"
	"log"
	"strings"
)

func main() {
	// ─────────────────────────────────────────────
	// 1. Create client (which creates sandbox automatically)
	// ─────────────────────────────────────────────
	fmt.Println("Creating sandbox...")
	c, err := client.New("base", 300)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer c.Close() // Automatically clean up sandbox

	fmt.Printf("Sandbox created: %s\n", c.SandboxID())
	fmt.Println(strings.Repeat("─", 50))

	ctx := context.Background()

	// ─────────────────────────────────────────────
	// 2. List root directory
	// ─────────────────────────────────────────────
	fmt.Println("Listing root directory...")
	files, err := c.ListDir(ctx, "/")
	if err != nil {
		log.Printf("Failed to list directory: %v", err)
	} else {
		fmt.Printf("Found %d items in root\n", len(files.Msg.Entries))
	}
	fmt.Println(strings.Repeat("─", 50))

	// ─────────────────────────────────────────────
	// 3. Run a simple command with streaming output
	// ─────────────────────────────────────────────
	fmt.Println("Running echo command (streaming)...")
	// Build a tiny in-memory shell script that prints a multi-line banner,
	// forks a background job that counts to 5, then waits for it and exits.
	script := `set -e
cat <<'EOF'

╔══════════════════════════════════════╗
║  Hello from E2B!                     ║
║  (but make it complicated)           ║
╚══════════════════════════════════════╝
EOF
(
  for i in {1..5}; do
    echo "[bg-job] step $i"
    sleep 0.2
  done
) &
wait
echo "Background job finished — goodbye!"
`
	result, err := c.RunCommand(ctx, "/bin/bash", []string{"-c", script})
	if err != nil {
		log.Printf("Failed to run command: %v", err)
	} else {
		fmt.Printf("Command completed successfully with PID %d, exit code %d\n", result.PID, result.ExitCode)
		if result.Stdout != "" {
			fmt.Printf("Output:\n%s\n", result.Stdout)
		}
	}
	fmt.Println(strings.Repeat("─", 50))

	// ─────────────────────────────────────────────
	// 4. Run a command and capture output directly
	// ─────────────────────────────────────────────
	fmt.Println("Running command with output capture...")
	output, err := c.RunCommandWithOutput(ctx, "uname", []string{"-a"})
	if err != nil {
		log.Printf("Failed to run command with output: %v", err)
	} else {
		fmt.Printf("System info: %s\n", output)
	}
	fmt.Println(strings.Repeat("─", 50))

	// ─────────────────────────────────────────────
	// 5. Run a shell command with output capture
	// ─────────────────────────────────────────────
	fmt.Println("Running shell command...")
	shellOutput, err := c.RunShellCommandWithOutput(ctx, "echo 'Shell command works!' && date")
	if err != nil {
		log.Printf("Failed to run shell command: %v", err)
	} else {
		fmt.Printf("Shell output:\n%s\n", shellOutput)
	}
	fmt.Println(strings.Repeat("─", 50))

	// ─────────────────────────────────────────────
	fmt.Println("Example completed successfully!")
}
