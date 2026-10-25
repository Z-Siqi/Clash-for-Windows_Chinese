package tun

import (
	"net"
	"testing"
)

func TestMulticastBoundariesAndCompatibility(t *testing.T) {
	for _, test := range []struct {
		destination string
		filtered    bool
	}{
		{"223.255.255.255", false}, {"224.0.0.0", true},
		{"224.0.0.251", true}, {"224.0.0.252", true},
		{"239.255.255.250", true}, {"239.255.255.255", true},
		{"240.0.0.0", false}, {"255.255.255.255", false},
		{"10.0.0.1", false}, {"192.168.1.10", false},
	} {
		packet := make([]byte, 20)
		packet[0] = 0x45
		copy(packet[16:], net.ParseIP(test.destination).To4())
		if got := FilterIPv4Multicast(packet, false); got != test.filtered {
			t.Errorf("%s filtered=%v, want %v", test.destination, got, test.filtered)
		}
		if FilterIPv4Multicast(packet, true) {
			t.Errorf("compatibility mode filtered %s", test.destination)
		}
	}
}

func TestTruncatedAndIPv6PacketsDoNotPanic(t *testing.T) {
	for length := 0; length < 20; length++ {
		packet := make([]byte, length)
		if length > 0 {
			packet[0] = 0x45
		}
		if FilterIPv4Multicast(packet, false) {
			t.Fatal("classified a truncated packet")
		}
	}
	packet := make([]byte, 40)
	packet[0], packet[16] = 0x60, 0xe0
	if FilterIPv4Multicast(packet, false) {
		t.Fatal("interpreted IPv6 as IPv4")
	}
}
