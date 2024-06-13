package dns

import (
	"log"
	"net"
	"sync"

	resolver "github.com/miekg/dns"
)

const (
	averageRecordsSize = 4096
)

type DNS struct {
	records map[string]string
	mu      sync.RWMutex
}

func New() *DNS {
	return &DNS{
		records: make(map[string]string, averageRecordsSize),
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

func (d *DNS) get(hostname string) (string, bool) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	ip, found := d.records[hostname]

	return ip, found
}

func (d *DNS) handleDNSRequest(w resolver.ResponseWriter, r *resolver.Msg) {
	m := new(resolver.Msg)
	m.SetReply(r)
	m.Compress = false

	for _, q := range m.Question {
		switch q.Qtype {
		case resolver.TypeA:
			ip, found := d.get(q.Name)
			if found {
				a := &resolver.A{
					Hdr: resolver.RR_Header{
						Name:   q.Name,
						Rrtype: resolver.TypeA,
						Class:  resolver.ClassINET,
						Ttl:    30,
					},
					A: net.ParseIP(ip).To4(),
				}

				m.Answer = append(m.Answer, a)
			}
		}
	}

	w.WriteMsg(m)
}

func (d *DNS) Start(address string) {
	resolver.HandleFunc(".", d.handleDNSRequest)

	server := &resolver.Server{Addr: address, Net: "udp"}

	log.Printf("Starting DNS server at %s\n", server.Addr)

	err := server.ListenAndServe()
	if err != nil {
		log.Fatalf("Failed to start server: %s\n", err.Error())
	}
}
