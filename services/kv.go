/**
 * 应用级键值存储（替代原 utools dbStorage）。
 * 内存 map + 持久化到用户配置目录下的 JSON 文件，原子写（tmp + rename）。
 */
package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// KVService 键值存储。
type KVService struct {
	mu   sync.Mutex
	data map[string]any
	path string
}

func NewKVService() *KVService {
	path := "dsh-plugin-manager-kv.json"
	if dir, err := os.UserConfigDir(); err == nil {
		path = filepath.Join(dir, "dsh-plugin-manager", "kv.json")
	}
	kv := &KVService{data: map[string]any{}, path: path}
	kv.load()
	return kv
}

func (s *KVService) load() {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return
	}
	if err := json.Unmarshal(raw, &s.data); err != nil {
		s.data = map[string]any{}
	}
	if s.data == nil {
		s.data = map[string]any{}
	}
}

func (s *KVService) save() {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return
	}
	_ = os.Rename(tmp, s.path)
}

func (s *KVService) GetItem(key string) any {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data[key]
}

func (s *KVService) SetItem(key string, value any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[key] = value
	s.save()
}

func (s *KVService) RemoveItem(key string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, key)
	s.save()
}
