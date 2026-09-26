package main

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

const defaultListenAddress = "127.0.0.1:53000"

type manifestEntry struct {
	Name   string `json:"name"`
	SHA256 string `json:"sha256"`
}

type coreManifest struct {
	Cores   []manifestEntry `json:"cores"`
	Helpers []manifestEntry `json:"helpers"`
}

type startRequest struct {
	Path   string `json:"path"`
	CWD    string `json:"cwd"`
	Silent bool   `json:"silent"`
}

type systemProxyRequest struct {
	Path string   `json:"path"`
	Args []string `json:"args"`
}

type managedProcess struct {
	command *exec.Cmd
	done    chan error
}

type processManager struct {
	operation sync.Mutex
	mutex     sync.Mutex
	current   *managedProcess
}

func executableDirectory() (string, error) {
	executable, err := os.Executable()
	if err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(executable)
	if err != nil {
		resolved = executable
	}
	return filepath.Dir(resolved), nil
}

func serviceListenAddress() string {
	address := os.Getenv("CFW_SERVICE_TEST_LISTEN_ADDRESS")
	if os.Getenv("CFW_SERVICE_TEST_MODE") != "1" || address == "" {
		return defaultListenAddress
	}
	host, port, err := net.SplitHostPort(address)
	if err != nil || port == "" {
		return defaultListenAddress
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return defaultListenAddress
	}
	return address
}

func loadAllowedExecutables(directory string) (map[string]string, map[string]string, error) {
	content, err := os.ReadFile(filepath.Join(directory, "core-hashes.json"))
	if err != nil {
		return nil, nil, fmt.Errorf("read core manifest: %w", err)
	}
	var manifest coreManifest
	if err := json.Unmarshal(content, &manifest); err != nil {
		return nil, nil, fmt.Errorf("parse core manifest: %w", err)
	}
	loadEntries := func(entries []manifestEntry) (map[string]string, error) {
		allowed := make(map[string]string, len(entries))
		for _, entry := range entries {
			name := filepath.Base(entry.Name)
			digest := strings.ToLower(strings.TrimSpace(entry.SHA256))
			if name != entry.Name || len(digest) != sha256.Size*2 {
				return nil, errors.New("core manifest contains an invalid entry")
			}
			if _, err := hex.DecodeString(digest); err != nil {
				return nil, errors.New("core manifest contains an invalid digest")
			}
			allowed[name] = digest
		}
		return allowed, nil
	}
	cores, err := loadEntries(manifest.Cores)
	if err != nil {
		return nil, nil, err
	}
	if len(cores) == 0 {
		return nil, nil, errors.New("core manifest is empty")
	}
	helpers, err := loadEntries(manifest.Helpers)
	if err != nil {
		return nil, nil, err
	}
	return cores, helpers, nil
}

func validateExecutable(path string, allowed map[string]string, kind string) (string, error) {
	if !filepath.IsAbs(path) {
		return "", fmt.Errorf("%s path must be absolute", kind)
	}
	resolved, err := filepath.EvalSymlinks(filepath.Clean(path))
	if err != nil {
		return "", fmt.Errorf("%s path cannot be resolved", kind)
	}
	info, err := os.Stat(resolved)
	if err != nil || !info.Mode().IsRegular() {
		return "", fmt.Errorf("%s path is not a regular file", kind)
	}
	expected, ok := allowed[filepath.Base(path)]
	if !ok {
		return "", fmt.Errorf("%s is not allow-listed", kind)
	}
	file, err := os.Open(resolved)
	if err != nil {
		return "", fmt.Errorf("%s cannot be opened", kind)
	}
	defer file.Close()
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", fmt.Errorf("%s cannot be hashed", kind)
	}
	actual := hex.EncodeToString(hasher.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(actual), []byte(expected)) != 1 {
		return "", fmt.Errorf("%s hash is not allow-listed", kind)
	}
	return resolved, nil
}

func validateCore(path string, allowed map[string]string) (string, error) {
	return validateExecutable(path, allowed, "core")
}

func validSystemProxyArgs(args []string) bool {
	if len(args) == 1 {
		return args[0] == "-show" || args[0] == "-stop"
	}
	if len(args) == 2 {
		return (args[0] == "-bypass" || args[0] == "-dns") && len(args[1]) <= 16*1024
	}
	if len(args) != 6 {
		return false
	}
	if args[0] != "-http" || args[2] != "-https" || args[4] != "-socks" {
		return false
	}
	for _, value := range []string{args[1], args[3], args[5]} {
		if value == "" || len(value) > 1024 {
			return false
		}
	}
	return true
}

func validateWorkingDirectory(path string) (string, error) {
	if !filepath.IsAbs(path) {
		return "", errors.New("working directory must be absolute")
	}
	cleaned := filepath.Clean(path)
	info, err := os.Stat(cleaned)
	if err != nil || !info.IsDir() {
		return "", errors.New("working directory does not exist")
	}
	return cleaned, nil
}

func (manager *processManager) stopCurrent() {
	manager.mutex.Lock()
	process := manager.current
	manager.current = nil
	manager.mutex.Unlock()
	if process == nil || process.command.Process == nil {
		return
	}
	pid := process.command.Process.Pid
	_ = syscall.Kill(-pid, syscall.SIGTERM)
	select {
	case <-process.done:
		return
	case <-time.After(2 * time.Second):
		_ = syscall.Kill(-pid, syscall.SIGKILL)
		<-process.done
	}
}

func (manager *processManager) stop() {
	manager.operation.Lock()
	defer manager.operation.Unlock()
	manager.stopCurrent()
}

func (manager *processManager) start(corePath, workingDirectory string, silent bool) (string, error) {
	manager.operation.Lock()
	defer manager.operation.Unlock()
	manager.stopCurrent()
	logPath := ""
	var output io.Writer = io.Discard
	var logFile *os.File
	if !silent {
		logDirectory := filepath.Join(workingDirectory, "logs")
		if err := os.MkdirAll(logDirectory, 0o755); err != nil {
			return "", err
		}
		logPath = filepath.Join(logDirectory, time.Now().Format("2006-01-02-150405")+".log")
		var err error
		logFile, err = os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return "", err
		}
		output = logFile
	}
	command := exec.Command(corePath, "-d", workingDirectory)
	command.Dir = filepath.Dir(corePath)
	command.Stdout = output
	command.Stderr = output
	command.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := command.Start(); err != nil {
		if logFile != nil {
			_ = logFile.Close()
		}
		return "", err
	}
	process := &managedProcess{command: command, done: make(chan error, 1)}
	manager.mutex.Lock()
	manager.current = process
	manager.mutex.Unlock()
	go func() {
		process.done <- command.Wait()
		if logFile != nil {
			_ = logFile.Close()
		}
		manager.mutex.Lock()
		if manager.current == process {
			manager.current = nil
		}
		manager.mutex.Unlock()
	}()
	return logPath, nil
}

func writeJSON(response http.ResponseWriter, status int, value any) {
	response.Header().Set("Content-Type", "application/json")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(value)
}

func main() {
	directory, err := executableDirectory()
	if err != nil {
		log.Fatal(err)
	}
	allowedCores, allowedHelpers, err := loadAllowedExecutables(directory)
	if err != nil {
		log.Fatal(err)
	}
	manager := &processManager{}
	var proxyOperation sync.Mutex
	mux := http.NewServeMux()
	mux.HandleFunc("/ping", func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			writeJSON(response, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		writeJSON(response, http.StatusOK, "ok")
	})
	mux.HandleFunc("/start", func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			writeJSON(response, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		request.Body = http.MaxBytesReader(response, request.Body, 64*1024)
		var payload startRequest
		decoder := json.NewDecoder(request.Body)
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&payload); err != nil {
			writeJSON(response, http.StatusBadRequest, "invalid request")
			return
		}
		corePath, err := validateCore(payload.Path, allowedCores)
		if err != nil {
			writeJSON(response, http.StatusForbidden, err.Error())
			return
		}
		workingDirectory, err := validateWorkingDirectory(payload.CWD)
		if err != nil {
			writeJSON(response, http.StatusBadRequest, err.Error())
			return
		}
		logPath, err := manager.start(corePath, workingDirectory, payload.Silent)
		if err != nil {
			writeJSON(response, http.StatusInternalServerError, "core could not be started")
			return
		}
		writeJSON(response, http.StatusOK, logPath)
	})
	mux.HandleFunc("/system-proxy", func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			writeJSON(response, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		request.Body = http.MaxBytesReader(response, request.Body, 32*1024)
		var payload systemProxyRequest
		decoder := json.NewDecoder(request.Body)
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&payload); err != nil || !validSystemProxyArgs(payload.Args) {
			writeJSON(response, http.StatusBadRequest, "invalid request")
			return
		}
		helperPath, err := validateExecutable(payload.Path, allowedHelpers, "helper")
		if err != nil || filepath.Base(helperPath) != "sysproxy" {
			writeJSON(response, http.StatusForbidden, "system proxy helper is not allow-listed")
			return
		}
		proxyOperation.Lock()
		defer proxyOperation.Unlock()
		ctx, cancel := context.WithTimeout(request.Context(), 15*time.Second)
		defer cancel()
		command := exec.CommandContext(ctx, helperPath, payload.Args...)
		command.Dir = filepath.Dir(helperPath)
		output, err := command.CombinedOutput()
		if err != nil {
			writeJSON(response, http.StatusInternalServerError, string(output))
			return
		}
		writeJSON(response, http.StatusOK, string(output))
	})
	mux.HandleFunc("/stop", func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			writeJSON(response, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		manager.stop()
		writeJSON(response, http.StatusOK, "stopped")
	})

	listener, err := net.Listen("tcp", serviceListenAddress())
	if err != nil {
		log.Fatal(err)
	}
	server := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 2 * time.Second,
		ReadTimeout:       5 * time.Second,
		WriteTimeout:      5 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    16 * 1024,
	}
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-signals
		manager.stop()
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()
	if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
