package credstore

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// machineFingerprint is the SK-CLI-009 AES-GCM "machine-keyed" input:
// SHA-256(machine-id || per-user salt). The salt is a 32-byte random
// blob at ~/.config/nlqdb/.salt (mode 0600) written on first use —
// /etc/machine-id is world-readable on Linux (machine-id(5)), so the
// salt is what keeps an unprivileged process on the same box from
// re-deriving the key.
func machineFingerprint() ([]byte, error) {
	raw, err := readMachineID()
	if err != nil {
		return nil, err
	}
	salt, err := readOrCreateSalt()
	if err != nil {
		return nil, err
	}
	h := sha256.New()
	h.Write([]byte(raw))
	h.Write(salt)
	return h.Sum(nil), nil
}

func readMachineID() (string, error) {
	switch runtime.GOOS {
	case "linux":
		return readLinuxMachineID()
	case "darwin":
		return readDarwinIOPlatformUUID()
	case "windows":
		return readWindowsMachineGUID()
	default:
		return "", fmt.Errorf("machine-id unsupported on %s", runtime.GOOS)
	}
}

func readLinuxMachineID() (string, error) {
	for _, p := range []string{"/etc/machine-id", "/var/lib/dbus/machine-id"} {
		data, err := os.ReadFile(p) //nolint:gosec // hard-coded canonical path
		if err == nil {
			id := strings.TrimSpace(string(data))
			if id != "" {
				return id, nil
			}
		}
	}
	return "", errors.New("machine-id not present at /etc/machine-id or /var/lib/dbus/machine-id")
}

func readDarwinIOPlatformUUID() (string, error) {
	out, err := exec.Command("/usr/sbin/ioreg", "-rd1", "-c", "IOPlatformExpertDevice").Output()
	if err != nil {
		return "", fmt.Errorf("ioreg: %w", err)
	}
	for _, line := range strings.Split(string(out), "\n") {
		if !strings.Contains(line, "IOPlatformUUID") {
			continue
		}
		idx := strings.Index(line, "\"=")
		if idx == -1 {
			continue
		}
		rest := line[idx+2:]
		rest = strings.TrimSpace(rest)
		rest = strings.Trim(rest, "\"")
		if rest != "" {
			return rest, nil
		}
	}
	return "", errors.New("IOPlatformUUID not found in ioreg output")
}

func readWindowsMachineGUID() (string, error) {
	out, err := exec.Command(
		"reg", "query",
		`HKLM\SOFTWARE\Microsoft\Cryptography`, "/v", "MachineGuid",
	).Output()
	if err != nil {
		return "", fmt.Errorf("reg query: %w", err)
	}
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "MachineGuid") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) >= 3 {
			return fields[len(fields)-1], nil
		}
	}
	return "", errors.New("MachineGuid not present under HKLM\\SOFTWARE\\Microsoft\\Cryptography")
}
