package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func fixturePolicy(t *testing.T) (string, *servicePolicy) {
	t.Helper()
	t.Setenv("CFW_SERVICE_TEST_MODE", "1")
	directory := t.TempDir()
	home := filepath.Join(directory, "data")
	if err := os.MkdirAll(home, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(directory, "cores"), 0755); err != nil {
		t.Fatal(err)
	}
	executable := []byte("#!/bin/sh\nprintf 'fixture core started\\n'\nsleep 30\n")
	digest := sha256.Sum256(executable)
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		t.Fatal(err)
	}
	policy := &servicePolicy{DataDirectory: home, Token: hex.EncodeToString(token)}
	config, _ := json.Marshal(policy)
	manifest, _ := json.Marshal(coreManifest{Cores: []manifestEntry{{Name: "clash-linux", SHA256: hex.EncodeToString(digest[:])}}})
	for name, content := range map[string][]byte{"service-config.json": config, "core-hashes.json": manifest, "cores/clash-linux": executable} {
		if err := os.WriteFile(filepath.Join(directory, name), content, 0700); err != nil {
			t.Fatal(err)
		}
	}
	loaded, err := loadServicePolicy(directory)
	if err != nil {
		t.Fatal(err)
	}
	return directory, loaded
}

func TestServicePolicyRejectsNetworkPathsAndModifiedCores(t *testing.T) {
	directory, policy := fixturePolicy(t)
	for _, name := range []string{"/bin/sh", "../clash-linux", filepath.Join(directory, "cores/clash-linux"), "unknown"} {
		if _, err := rejectUnknownCore(name, policy.corePaths); err == nil {
			t.Fatal("untrusted core accepted")
		}
	}
	target, err := rejectUnknownCore("clash-linux", policy.corePaths)
	if err != nil || target != filepath.Join(directory, "cores/clash-linux") {
		t.Fatal("fixed installed core not selected")
	}
	if err := os.WriteFile(target, []byte("modified executable"), 0700); err != nil {
		t.Fatal(err)
	}
	if _, err := loadServicePolicy(directory); err == nil {
		t.Fatal("modified installed core accepted")
	}
}

func TestServiceAuthorizationRejectsMissingCredentialsOriginsAndRebinding(t *testing.T) {
	_, policy := fixturePolicy(t)
	called := 0
	handler := policy.authorize(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { called++; w.WriteHeader(200) }))
	for _, input := range []struct {
		auth, origin, host string
		allowed            bool
	}{
		{"", "", "127.0.0.1:12345", false},
		{"Bearer invalid", "", "127.0.0.1:12345", false},
		{"Bearer " + policy.Token, "https://untrusted.invalid", "127.0.0.1:12345", false},
		{"Bearer " + policy.Token, "", "rebind.invalid:12345", false},
		{"Bearer " + policy.Token, "", "127.0.0.1:12345", true},
	} {
		request := httptest.NewRequest("POST", "http://127.0.0.1:12345/stop", nil)
		request.Host = input.host
		request.Header.Set("Authorization", input.auth)
		request.Header.Set("Origin", input.origin)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if (response.Code == 200) != input.allowed {
			t.Fatal("unexpected authorization decision")
		}
	}
	if called != 1 {
		t.Fatal("unauthorized request reached service handler")
	}
}

func TestServiceLogsRejectSymlinksAndManagedCoreUsesFixedData(t *testing.T) {
	directory, policy := fixturePolicy(t)
	outside := filepath.Join(directory, "outside")
	if err := os.Mkdir(outside, 0755); err != nil {
		t.Fatal(err)
	}
	logs := filepath.Join(policy.DataDirectory, "logs")
	if err := os.Symlink(outside, logs); err != nil {
		t.Fatal(err)
	}
	if _, err := policy.logDirectory(); err == nil {
		t.Fatal("redirected logs accepted")
	}
	if err := os.Remove(logs); err != nil {
		t.Fatal(err)
	}
	manager := &processManager{}
	t.Cleanup(manager.stop)
	log, err := manager.start(policy.corePaths["clash-linux"], policy, false)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Dir(log) != logs {
		t.Fatal("core log escapes fixed data directory")
	}
	manager.stop()
}

func TestProtectedPathsRejectUserWritableAncestors(t *testing.T) {
	directory, _ := fixturePolicy(t)
	t.Setenv("CFW_SERVICE_TEST_MODE", "0")
	if err := requireProtectedPath(filepath.Join(directory, "cores/clash-linux")); err == nil {
		t.Fatal("user-writable service hierarchy accepted")
	}
}

func TestSystemProxyOnlyAcceptsNamedOperations(t *testing.T) {
	for _, args := range [][]string{{"-show"}, {"-stop"}, {"-dns", "127.0.0.1,::1"}, {"-dns", "reset"}, {"-http", "127.0.0.1:7890", "-https", "127.0.0.1:7890", "-socks", "127.0.0.1:7890"}} {
		if !validSystemProxyArgs(args) {
			t.Fatal("valid proxy operation rejected")
		}
	}
	for _, args := range [][]string{{"-command", "id"}, {"-dns", "127.0.0.1;id"}, {"-bypass", "domain\n-injected"}, {"-http", "127.0.0.1:7890"}} {
		if validSystemProxyArgs(args) {
			t.Fatal("invalid proxy operation accepted")
		}
	}
}
