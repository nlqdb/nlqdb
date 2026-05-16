package credstore

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/nlqdb/nlqdb/cli/internal/paths"
)

// fallbackFile encrypts secrets with an HKDF-derived AES-GCM key whose
// input is the machine fingerprint, so a backup of credentials.enc to
// a different host is unreadable (SK-CLI-009).
type fallbackFile struct {
	Version int               `json:"v"`
	Entries map[string]string `json:"entries"`
}

const (
	fallbackVersion = 1
	hkdfInfo        = "nlqdb-cli-credstore-aes256-gcm-v1"
)

func loadFallback() (fallbackFile, error) {
	empty := fallbackFile{Version: fallbackVersion, Entries: map[string]string{}}
	p, err := paths.CredentialsEnc()
	if err != nil {
		return empty, err
	}
	data, err := os.ReadFile(p) //nolint:gosec // computed XDG path
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return empty, nil
		}
		return empty, fmt.Errorf("read credentials.enc: %w", err)
	}
	if len(data) == 0 {
		return empty, nil
	}
	plain, err := decryptBlob(data)
	if err != nil {
		return empty, err
	}
	var ff fallbackFile
	if err := json.Unmarshal(plain, &ff); err != nil {
		return empty, fmt.Errorf("parse credentials.enc: %w", err)
	}
	if ff.Entries == nil {
		ff.Entries = map[string]string{}
	}
	return ff, nil
}

func saveFallback(ff fallbackFile) error {
	p, err := paths.CredentialsEnc()
	if err != nil {
		return err
	}
	ff.Version = fallbackVersion
	plain, err := json.Marshal(ff)
	if err != nil {
		return fmt.Errorf("encode credentials.enc: %w", err)
	}
	blob, err := encryptBlob(plain)
	if err != nil {
		return err
	}
	dir := filepath.Dir(p)
	tmp, err := os.CreateTemp(dir, ".credentials-*.enc")
	if err != nil {
		return fmt.Errorf("create tmp credentials: %w", err)
	}
	tmpName := tmp.Name()
	defer func() { _ = os.Remove(tmpName) }()
	if _, err := tmp.Write(blob); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("write tmp credentials: %w", err)
	}
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("chmod tmp credentials: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close tmp credentials: %w", err)
	}
	return os.Rename(tmpName, p)
}

func deriveKey() ([]byte, error) {
	fp, err := machineFingerprint()
	if err != nil {
		return nil, fmt.Errorf("derive machine fingerprint: %w", err)
	}
	out, err := hkdf.Key(sha256.New, fp, nil, hkdfInfo, 32)
	if err != nil {
		return nil, fmt.Errorf("hkdf key: %w", err)
	}
	return out, nil
}

func encryptBlob(plain []byte) ([]byte, error) {
	key, err := deriveKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("aes cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm wrap: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("rand nonce: %w", err)
	}
	out := make([]byte, 0, len(nonce)+len(plain)+gcm.Overhead())
	out = append(out, nonce...)
	return gcm.Seal(out, nonce, plain, nil), nil
}

func decryptBlob(blob []byte) ([]byte, error) {
	key, err := deriveKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("aes cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm wrap: %w", err)
	}
	ns := gcm.NonceSize()
	if len(blob) < ns+gcm.Overhead() {
		return nil, errors.New("credentials.enc: ciphertext too short")
	}
	nonce, ct := blob[:ns], blob[ns:]
	return gcm.Open(nil, nonce, ct, nil)
}
