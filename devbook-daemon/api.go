package main

import (
	"log"
	"time"

	"github.com/devbookhq/orchestration-services/devbookd/internal"
)

type Comm struct{}

func (c *Comm) Hello(args *internal.HelloArgs, reply *internal.HelloReply) error {
	*reply = "Hello!"
	log.Println(args, *reply)
	time.Sleep(1 * time.Second)
	return nil
}
