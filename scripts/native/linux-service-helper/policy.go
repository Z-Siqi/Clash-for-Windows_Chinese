package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
)

type servicePolicy struct {
	DataDirectory string `json:"dataDirectory"`
	Token         string `json:"token"`
	corePaths     map[string]string
	proxyPath     string
}

func testMode() bool { return os.Getenv("CFW_SERVICE_TEST_MODE") == "1" }

func installationDirectory() string {
	if runtime.GOOS == "darwin" {
		return "/Library/PrivilegedHelperTools/com.lbyczf.cfw"
	}
	return "/usr/lib/clash-for-windows-service"
}

// A root-owned file in a user-writable directory is still replaceable. Check
// every parent, and never execute binaries selected by an HTTP-supplied path.
func requireProtectedPath(value string) error {
	if testMode() {
		return nil
	}
	for current := value; ; current = filepath.Dir(current) {
		info, err := os.Lstat(current)
		if err != nil {
			return err
		}
		stat, ok := info.Sys().(*syscall.Stat_t)
		if !ok || stat.Uid != 0 || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0022 != 0 {
			return errors.New("service installation is not protected")
		}
		if current == filepath.Dir(current) {
			return nil
		}
	}
}

func loadServicePolicy(directory string) (*servicePolicy, error) {
	if !testMode() && directory != installationDirectory() {
		return nil, errors.New("unsupported service installation")
	}
	if err := requireProtectedPath(directory); err != nil {
		return nil, err
	}
	configPath := filepath.Join(directory, "service-config.json")
	if err := requireProtectedPath(configPath); err != nil {
		return nil, err
	}
	content, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}
	policy := &servicePolicy{}
	if err := json.Unmarshal(content, policy); err != nil {
		return nil, err
	}
	decoded, err := hex.DecodeString(policy.Token)
	if err != nil || len(decoded) != 32 {
		return nil, errors.New("invalid service credentials")
	}
	if !filepath.IsAbs(policy.DataDirectory) {
		return nil, errors.New("invalid service data directory")
	}
	resolved, err := filepath.EvalSymlinks(policy.DataDirectory)
	if err != nil || resolved != filepath.Clean(policy.DataDirectory) {
		return nil, errors.New("service data directory is redirected")
	}
	info, err := os.Stat(resolved)
	if err != nil || !info.IsDir() {
		return nil, errors.New("service data directory is absent")
	}
	policy.DataDirectory = resolved
	manifestPath := filepath.Join(directory, "core-hashes.json")
	if err := requireProtectedPath(manifestPath); err != nil {
		return nil, err
	}
	cores, helpers, err := loadAllowedExecutables(directory)
	if err != nil {
		return nil, err
	}
	policy.corePaths = make(map[string]string)
	for name, digest := range cores {
		switch name {
		case "clash-linux", "mihomo-linux-amd64", "mihomo-linux-arm64", "clash-darwin", "mihomo-darwin-amd64", "mihomo-darwin-arm64":
		default:
			return nil, errors.New("unsupported packaged core")
		}
		target := filepath.Join(directory, "cores", name)
		if err := verifyInstalledExecutable(target, digest); err != nil {
			return nil, err
		}
		policy.corePaths[name] = target
	}
	if digest, exists := helpers["sysproxy"]; exists {
		policy.proxyPath = filepath.Join(directory, "cores", "sysproxy")
		if err := verifyInstalledExecutable(policy.proxyPath, digest); err != nil {
			return nil, err
		}
	}
	return policy, nil
}

func verifyInstalledExecutable(target, expected string) error {
	if err := requireProtectedPath(target); err != nil {
		return err
	}
	info, err := os.Lstat(target)
	if err != nil || !info.Mode().IsRegular() {
		return errors.New("packaged executable is not a regular file")
	}
	file, err := os.Open(target)
	if err != nil {
		return err
	}
	defer file.Close()
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return err
	}
	actual := hex.EncodeToString(hasher.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(actual), []byte(expected)) != 1 {
		return errors.New("packaged executable hash mismatch")
	}
	return nil
}

func (policy *servicePolicy) authorize(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		host, _, err := net.SplitHostPort(request.Host)
		ip := net.ParseIP(host)
		expected := "Bearer " + policy.Token
		if err != nil || ip == nil || !ip.IsLoopback() || request.Header.Get("Origin") != "" ||
			subtle.ConstantTimeCompare([]byte(request.Header.Get("Authorization")), []byte(expected)) != 1 {
			writeJSON(response, http.StatusForbidden, "unauthorized service request")
			return
		}
		next.ServeHTTP(response, request)
	})
}

func (policy *servicePolicy) logDirectory() (string, error) {
	// The data directory is fixed at installation; reject redirected log folders.
	directory := filepath.Join(policy.DataDirectory, "logs")
	if err := os.MkdirAll(directory, 0755); err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(directory)
	if err != nil || resolved != directory {
		return "", errors.New("core logs directory is redirected")
	}
	return directory, nil
}

func rejectUnknownCore(name string, paths map[string]string) (string, error) {
	target, exists := paths[name]
	if !exists {
		return "", fmt.Errorf("core is not installed")
	}
	return target, nil
}

func validSystemProxyArgs(args []string) bool {
	if len(args) == 1 {
		return args[0] == "-show" || args[0] == "-stop"
	}
	if len(args) == 2 {
		if args[0] == "-dns" {
			if args[1] == "query" || args[1] == "reset" {
				return true
			}
			values := strings.Split(args[1], ",")
			if len(values) > 16 {
				return false
			}
			for _, address := range values {
				if net.ParseIP(address) == nil {
					return false
				}
			}
			return true
		}
		return args[0] == "-bypass" && len(args[1]) <= 16*1024 && !strings.ContainsAny(args[1], "\x00\r\n")
	}
	if len(args) != 6 || args[0] != "-http" || args[2] != "-https" || args[4] != "-socks" {
		return false
	}
	for _, value := range []string{args[1], args[3], args[5]} {
		host, port, err := net.SplitHostPort(value)
		if err != nil || host == "" || len(value) > 1024 || strings.ContainsAny(value, "\x00\r\n") || port == "" {
			return false
		}
	}
	return true
}
