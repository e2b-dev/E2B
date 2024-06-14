package dns

import (
	"log"
	"net"

	"github.com/e2b-dev/infra/packages/shared/pkg/smap"

	resolver "github.com/miekg/dns"
)

const ttl = 2

type DNS struct {
	records *smap.Map[string]
}

func New() *DNS {
	return &DNS{
		records: smap.New[string](),
	}
}

type Record interface {
	HostIP() string
	HostName() string
}

func (d *DNS) Add(record Record) {
	d.records.Insert(record.HostName(), record.HostIP())
}

func (d *DNS) Remove(record Record) {
	d.records.Remove(record.HostName())
}

func (d *DNS) get(hostname string) (string, bool) {
	return d.records.Get(hostname)
}

func (d *DNS) handleDNSRequest(w resolver.ResponseWriter, r *resolver.Msg) {
	m := new(resolver.Msg)
	m.SetReply(r)
	m.Compress = false
	m.Authoritative = true

	for _, q := range m.Question {
		if q.Qtype == resolver.TypeA {
			ip, found := d.get(q.Name)
			if found {
				a := &resolver.A{
					Hdr: resolver.RR_Header{
						Name:   q.Name,
						Rrtype: resolver.TypeA,
						Class:  resolver.ClassINET,
						Ttl:    ttl,
					},
					A: net.ParseIP(ip).To4(),
				}

				m.Answer = append(m.Answer, a)
			}
		}
	}

	err := w.WriteMsg(m)
	if err != nil {
		log.Printf("Failed to write message: %s\n", err.Error())
	}
}

func (d *DNS) Start(address string) {
	mux := resolver.NewServeMux()

	mux.HandleFunc(".", d.handleDNSRequest)

	server := resolver.Server{Addr: address, Net: "udp", Handler: mux}

	log.Printf("Starting DNS server at %s\n", server.Addr)

	err := server.ListenAndServe()
	if err != nil {
		log.Fatalf("Failed to start server: %s\n", err.Error())
	}
}
