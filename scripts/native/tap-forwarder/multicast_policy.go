package tun

// Set once before opening the adapter. Compatibility mode deliberately keeps
// the upstream forwarding behavior, including its multicast-loop risk.
var AllowMulticast bool

// FilterIPv4Multicast runs before lwIP sees the packet or creates a SOCKS flow.
// IPv6 is already discarded by the upstream Windows TAP reader.
func FilterIPv4Multicast(packet []byte, allow bool) bool {
	return !allow && len(packet) >= 20 && packet[0]>>4 == 4 && packet[16]&0xf0 == 0xe0
}
