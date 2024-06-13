package dns

import (
	"fmt"
	"log"
	"sync"

	dnsHandler "github.com/miekg/dns"
)

type DNS struct {
	records map[string]string
	mu      sync.RWMutex
}

func NewDNS() *DNS {
	return &DNS{
		records: make(map[string]string),
	}
}

type Record interface {
	HostIP() string
	HostName() string
}

func (d *DNS) Add(record Record) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.records[record.HostName()] = record.HostIP()
}

func (d *DNS) Remove(record Record) {
	d.mu.Lock()
	defer d.mu.Unlock()

	delete(d.records, record.HostName())
}

func (d *DNS) get(record Record) (string, bool) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	ip, found := d.records[record.HostName()]

	return ip, found
}

func (d *DNS) handleDNSRequest(w dns.ResponseWriter, r *dns.Msg) {
	m := new(dns.Msg)
	m.SetReply(r)
	m.Compress = false

	switch r.Opcode {
	case dns.OpcodeQuery:
		for _, q := range m.Question {
			ip, found := d.Get(q.Name)
			if found {
				rr, err := dns.NewRR(q.Name + " A " + ip)
				if err == nil {
					m.Answer = append(m.Answer, rr)
				}
			}
		}
	}

	w.WriteMsg(m)
}

func (d *DNS) Start(address string) {
	dns.HandleFunc(".", d.handleDNSRequest)

	server := &dns.Server{Addr: address, Net: "udp"}

	log.Printf("Starting DNS server at %s\n", server.Addr)

	err := server.ListenAndServe()
	if err != nil {
		log.Fatalf("Failed to start server: %s\n", err.Error())
	}
}

func main() {
	// Attach request handler func
	dns.HandleFunc(".", handleDNSRequest)

	// Start server
	server := &dns.Server{Addr: ":53", Net: "udp"}
	log.Printf("Starting DNS server at %s\n", server.Addr)
	err := server.ListenAndServe()
	if err != nil {
		log.Fatalf("Failed to start server: %s\n", err.Error())
	}
}
