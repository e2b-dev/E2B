package txeh

import (
	"fmt"
	"io/ioutil"
	"runtime"
	"strings"
	"sync"
)

const UNKNOWN = 0
const EMPTY = 10
const COMMENT = 20
const ADDRESS = 30

// HostsConfig
type HostsConfig struct {
	ReadFilePath  string
	WriteFilePath string
}

// Hosts
type Hosts struct {
	sync.Mutex
	*HostsConfig
	hostFileLines HostFileLines
}

// AddressLocations the location of an address in the HFL
type AddressLocations map[string]int

// HostLocations maps a hostname
// to an original line number
type HostLocations map[string]int

// HostFileLines
type HostFileLines []HostFileLine

// HostFileLine
type HostFileLine struct {
	OriginalLineNum int
	LineType        int
	Address         string
	Parts           []string
	Hostnames       []string
	Raw             string
	Trimed          string
	Comment         string
}

// NewHostsDefault returns a hosts object with
// default configuration
func NewHostsDefault() (*Hosts, error) {
	return NewHosts(&HostsConfig{})
}

// NewHosts returns a new hosts object
func NewHosts(hc *HostsConfig) (*Hosts, error) {
	h := &Hosts{HostsConfig: hc}
	h.Lock()
	defer h.Unlock()

	defaultHostsFile := "/etc/hosts"

	if runtime.GOOS == "windows" {
		defaultHostsFile = `C:\Windows\System32\Drivers\etc\hosts`
	}

	if h.ReadFilePath == "" {
		h.ReadFilePath = defaultHostsFile
	}

	if h.WriteFilePath == "" {
		h.WriteFilePath = h.ReadFilePath
	}

	hfl, err := ParseHosts(h.ReadFilePath)
	if err != nil {
		return nil, err
	}

	h.hostFileLines = hfl

	return h, nil
}

// Save rendered hosts file
func (h *Hosts) Save() error {
	return h.SaveAs(h.WriteFilePath)
}

// SaveAs saves rendered hosts file to the filename specified
func (h *Hosts) SaveAs(fileName string) error {
	hfData := []byte(h.RenderHostsFile())

	h.Lock()
	defer h.Unlock()

	err := ioutil.WriteFile(fileName, hfData, 0644)
	if err != nil {
		return err
	}

	return nil
}

// Reload hosts file
func (h *Hosts) Reload() error {
	h.Lock()
	defer h.Unlock()

	hfl, err := ParseHosts(h.ReadFilePath)
	if err != nil {
		return err
	}

	h.hostFileLines = hfl

	return nil
}

// RemoveAddresses removes all entries (lines) with the provided address.
func (h *Hosts) RemoveAddresses(addresses []string) {
	for _, address := range addresses {
		if h.RemoveFirstAddress(address) {
			h.RemoveAddress(address)
		}
	}
}

// RemoveAddress removes all entries (lines) with the provided address.
func (h *Hosts) RemoveAddress(address string) {
	if h.RemoveFirstAddress(address) {
		h.RemoveAddress(address)
	}
}

// RemoveFirstAddress removed the first entry (line) found with the provided address.
func (h *Hosts) RemoveFirstAddress(address string) bool {
	h.Lock()
	defer h.Unlock()

	for hflIdx := range h.hostFileLines {
		if address == h.hostFileLines[hflIdx].Address {
			h.hostFileLines = removeHFLElement(h.hostFileLines, hflIdx)
			return true
		}
	}

	return false
}

// RemoveHosts removes all hostname entries of the provided host slice
func (h *Hosts) RemoveHosts(hosts []string) {
	for _, host := range hosts {
		if h.RemoveFirstHost(host) {
			h.RemoveHost(host)
		}
	}
}

// RemoveHost removes all hostname entries of provided host
func (h *Hosts) RemoveHost(host string) {
	if h.RemoveFirstHost(host) {
		h.RemoveHost(host)
	}
}

// RemoveHost the first hostname entry found and returns true if successful
func (h *Hosts) RemoveFirstHost(host string) bool {
	h.Lock()
	defer h.Unlock()

	for hflIdx := range h.hostFileLines {
		for hidx, hst := range h.hostFileLines[hflIdx].Hostnames {
			if hst == host {
				h.hostFileLines[hflIdx].Hostnames = removeStringElement(h.hostFileLines[hflIdx].Hostnames, hidx)

				// remove the address line if empty
				if len(h.hostFileLines[hflIdx].Hostnames) < 1 {
					h.hostFileLines = removeHFLElement(h.hostFileLines, hflIdx)
				}
				return true
			}
		}
	}

	return false
}

// AddHosts adds an array of hosts to the first matching address it finds
// or creates the address and adds the hosts
func (h *Hosts) AddHosts(address string, hosts []string) {
	for _, hst := range hosts {
		h.AddHost(address, hst)
	}
}

// AddHost adds a host to an address and removes the host
// from any existing address is may be associated with
func (h *Hosts) AddHost(addressRaw string, hostRaw string) {
	host := strings.TrimSpace(strings.ToLower(hostRaw))
	address := strings.TrimSpace(strings.ToLower(addressRaw))

	// does the host already exist
	if ok, exAdd, hflIdx := h.HostAddressLookup(host); ok {
		// if the address is the same we are done
		if address == exAdd {
			return
		}

		// if the hostname is at a different address, go and remove it from the address
		for hidx, hst := range h.hostFileLines[hflIdx].Hostnames {
			if hst == host {
				h.Lock()
				h.hostFileLines[hflIdx].Hostnames = removeStringElement(h.hostFileLines[hflIdx].Hostnames, hidx)
				h.Unlock()

				// remove the address line if empty
				if len(h.hostFileLines[hflIdx].Hostnames) < 1 {
					h.Lock()
					h.hostFileLines = removeHFLElement(h.hostFileLines, hflIdx)
					h.Unlock()
				}

				break // unless we should continue because it could have duplicates
			}
		}
	}

	// if the address exists add it to the address line
	for i, hfl := range h.hostFileLines {
		if hfl.Address == address {
			h.Lock()
			h.hostFileLines[i].Hostnames = append(h.hostFileLines[i].Hostnames, host)
			h.Unlock()
			return
		}
	}

	// the address and host do not already exist so go ahead and create them
	hfl := HostFileLine{
		LineType:  ADDRESS,
		Address:   address,
		Hostnames: []string{host},
	}

	h.Lock()
	h.hostFileLines = append(h.hostFileLines, hfl)
	h.Unlock()
}

// HostAddressLookup returns true is the host is found, a string
// containing the address and the index of the hfl
func (h *Hosts) HostAddressLookup(host string) (bool, string, int) {
	h.Lock()
	defer h.Unlock()

	for i, hfl := range h.hostFileLines {
		for _, hn := range hfl.Hostnames {
			if hn == strings.ToLower(host) {
				return true, hfl.Address, i
			}
		}
	}

	return false, "", 0
}

// RenderHostsFile
func (h *Hosts) RenderHostsFile() string {
	h.Lock()
	defer h.Unlock()

	hf := ""

	for _, hfl := range h.hostFileLines {
		hf = hf + fmt.Sprintln(lineFormatter(hfl))
	}

	return hf
}

// GetHostFileLines
func (h *Hosts) GetHostFileLines() *HostFileLines {
	h.Lock()
	defer h.Unlock()

	return &h.hostFileLines
}

// ParseHosts
func ParseHosts(path string) ([]HostFileLine, error) {
	input, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	inputNormalized := strings.Replace(string(input), "\r\n", "\n", -1)

	lines := strings.Split(inputNormalized, "\n")
	dataLines := lines[:len(lines)-1]

	hostFileLines := make([]HostFileLine, len(dataLines))

	// trim leading an trailing whitespace
	for i, l := range dataLines {
		curLine := &hostFileLines[i]
		curLine.OriginalLineNum = i
		curLine.Raw = l

		// trim line
		curLine.Trimed = strings.TrimSpace(l)

		// check for comment
		if strings.HasPrefix(curLine.Trimed, "#") {
			curLine.LineType = COMMENT
			continue
		}

		if curLine.Trimed == "" {
			curLine.LineType = EMPTY
			continue
		}

		curLineSplit := strings.SplitN(curLine.Trimed, "#", 2)
		if len(curLineSplit) > 1 {
			curLine.Comment = curLineSplit[1]
		}
		curLine.Trimed = curLineSplit[0]

		curLine.Parts = strings.Fields(curLine.Trimed)

		if len(curLine.Parts) > 1 {
			curLine.LineType = ADDRESS
			curLine.Address = strings.ToLower(curLine.Parts[0])
			// lower case all
			for _, p := range curLine.Parts[1:] {
				curLine.Hostnames = append(curLine.Hostnames, strings.ToLower(p))
			}

			continue
		}

		// if we can't figure out what this line is
		// at this point mark it as unknown
		curLine.LineType = UNKNOWN

	}

	return hostFileLines, nil
}

// removeStringElement removed an element of a string slice
func removeStringElement(slice []string, s int) []string {
	return append(slice[:s], slice[s+1:]...)
}

// removeHFLElement removed an element of a HostFileLine slice
func removeHFLElement(slice []HostFileLine, s int) []HostFileLine {
	return append(slice[:s], slice[s+1:]...)
}

// lineFormatter
func lineFormatter(hfl HostFileLine) string {

	if hfl.LineType < ADDRESS {
		return hfl.Raw
	}

	if len(hfl.Comment) > 0 {
		return fmt.Sprintf("%-16s %s #%s", hfl.Address, strings.Join(hfl.Hostnames, " "), hfl.Comment)
	}
	return fmt.Sprintf("%-16s %s", hfl.Address, strings.Join(hfl.Hostnames, " "))
}
