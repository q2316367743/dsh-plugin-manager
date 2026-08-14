/**
 * 通用文件读写服务（导出/导入 profile 视图 JSON 用）。
 * 本文件为原 src-utools/src/file.js 的 Go 翻译。
 */
package services

import "os"

// FileService 通用文件读写。
type FileService struct{}

func NewFileService() *FileService {
	return &FileService{}
}

func (s *FileService) ReadTextFile(path string) (string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func (s *FileService) WriteTextFile(path string, content string) error {
	return os.WriteFile(path, []byte(content), 0o644)
}
