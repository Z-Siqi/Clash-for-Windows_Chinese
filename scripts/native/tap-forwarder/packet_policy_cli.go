package main

import (
	"encoding/hex"
	"flag"
	"fmt"
	"os"

	"github.com/eycorsican/go-tun2socks/tun"
)

var allowMulticast = flag.Bool("allowMulticast", false, "Allow IPv4 multicast through TAP (legacy behavior; may cause forwarding loops)")
var checkPacket = flag.String("checkPacket", "", "Classify a hexadecimal IP packet without opening TAP")

func configurePacketPolicy() bool {
	tun.AllowMulticast = *allowMulticast
	if *checkPacket == "" {
		return false
	}
	packet, err := hex.DecodeString(*checkPacket)
	if err != nil {
		fmt.Fprintln(os.Stderr, "Invalid hexadecimal packet")
		os.Exit(2)
	}
	if tun.FilterIPv4Multicast(packet, *allowMulticast) {
		fmt.Println("DROP")
	} else {
		fmt.Println("FORWARD")
	}
	return true
}
