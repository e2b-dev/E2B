package main

import (
	"context"
	"fmt"
	"log"

	"github.com/e2b-dev/e2b/packages/go-sdk/client"
)

func main() {
	// Create client (which creates sandbox automatically)
	fmt.Println("Creating sandbox...")
	c, err := client.New("base", 300)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}
	defer c.Close() // Automatically clean up sandbox

	fmt.Printf("Sandbox created: %s\n", c.SandboxID())

	// Example operations using the unified client
	ctx := context.Background()

	// List root directory
	fmt.Println("Listing root directory...")
	files, err := c.ListDir(ctx, "/")
	if err != nil {
		log.Printf("Failed to list directory: %v", err)
	} else {
		fmt.Printf("Found %d items in root\n", len(files.Msg.Entries))
	}

	// Run a simple command
	fmt.Println("Running echo command...")
	stream, err := c.RunCommand(ctx, "echo", []string{"Hello from E2B!"})
	if err != nil {
		log.Printf("Failed to run command: %v", err)
	} else {
		fmt.Println("Command started successfully")
		
		// Read first few messages from the stream
		messageCount := 0
		for stream.Receive() && messageCount < 5 {
			msg := stream.Msg()
			if msg.Event != nil {
				fmt.Printf("Received process event\n")
			}
			messageCount++
		}
		
		if err := stream.Err(); err != nil {
			log.Printf("Stream error: %v", err)
		}
		stream.Close()
	}

	fmt.Println("Example completed successfully!")
}
