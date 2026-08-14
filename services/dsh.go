/**
 * dsh 生态访问服务：DSH_HOME 解析、profile 清单读写、cordis patch 读写、
 * bundle 行 id 解析、已安装包信息、dsh 可执行文件解析与校验。
 * 本文件为原 src-utools/src/dsh.js 的 Go 翻译，行为保持一致。
 */
package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

const (
	dshHomeDirName       = ".dsh"
	profilePatchFilename = "cordis.patch.yml"
)

// DshResolveResult dsh 可执行文件解析结果（state: ok | missing | invalid）。
type DshResolveResult struct {
	State   string   `json:"state"`
	Path    string   `json:"path,omitempty"`
	Command string   `json:"command,omitempty"`
	Prefix  []string `json:"prefix,omitempty"`
	Version string   `json:"version,omitempty"`
	Error   string   `json:"error,omitempty"`
}

type probeResult struct {
	ok      bool
	command string
	prefix  []string
	version string
	errMsg  string
}

// DshService dsh 生态访问层。
type DshService struct{}

func NewDshService() *DshService {
	return &DshService{}
}

/** $DSH_HOME：显式配置 > $DSH_HOME 环境变量 > ~/.dsh */
func (s *DshService) GetDshHome() string {
	if fromEnv := strings.TrimSpace(os.Getenv("DSH_HOME")); fromEnv != "" {
		return fromEnv
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return dshHomeDirName
	}
	return filepath.Join(home, dshHomeDirName)
}

func (s *DshService) profilesDir() string {
	return filepath.Join(s.GetDshHome(), "profiles")
}

func (s *DshService) profileDir(profile string) string {
	return filepath.Join(s.profilesDir(), profile)
}

/** 列出所有 profile（目录下存在 package.json 视为一个 profile）。 */
func (s *DshService) ListProfiles() []string {
	dir := s.profilesDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return []string{}
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if _, err := os.Stat(filepath.Join(dir, e.Name(), "package.json")); err == nil {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	return names
}

/** 读取 profile 的 package.json；不存在或解析失败返回 nil。 */
func (s *DshService) ReadProfileManifest(profile string) map[string]any {
	raw, err := os.ReadFile(filepath.Join(s.profileDir(profile), "package.json"))
	if err != nil {
		return nil
	}
	var manifest map[string]any
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return nil
	}
	return manifest
}

func (s *DshService) WriteProfileManifest(profile string, manifest map[string]any) error {
	raw, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.profileDir(profile), "package.json"), append(raw, '\n'), 0o644)
}

/** 读取 profile 级 cordis.patch.yml 原文；不存在时返回空串。 */
func (s *DshService) ReadProfilePatch(profile string) string {
	raw, err := os.ReadFile(filepath.Join(s.profileDir(profile), profilePatchFilename))
	if err != nil {
		return ""
	}
	return string(raw)
}

func (s *DshService) WriteProfilePatch(profile string, content string) error {
	return os.WriteFile(filepath.Join(s.profileDir(profile), profilePatchFilename), []byte(content), 0o644)
}

/**
 * 解析某个 bundle 在 profile 中的安装目录。
 * pnpm 的 hoisted 结构下，@deepseek-ai/* 位于 profiles/node_modules，
 * 第三方包位于 profiles/<profile>/node_modules，两处兜底。
 */
func (s *DshService) resolveBundleDir(profile, packageName string) string {
	candidates := []string{
		filepath.Join(s.profileDir(profile), "node_modules", packageName),
		filepath.Join(s.profilesDir(), "node_modules", packageName),
	}
	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(c, "package.json")); err == nil {
			return c
		}
	}
	return ""
}

/** 读取已安装包（bundle 或普通依赖）的 package.json；未安装返回 nil。 */
func (s *DshService) ReadInstalledPackage(profile, packageName string) map[string]any {
	dir := s.resolveBundleDir(profile, packageName)
	if dir == "" {
		return nil
	}
	raw, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if err != nil {
		return nil
	}
	var pkg map[string]any
	if err := json.Unmarshal(raw, &pkg); err != nil {
		return nil
	}
	return pkg
}

/** 读取 bundle 自带 patch（dsh.bundle.patch 指向的文件）原文；无则返回 nil。 */
func (s *DshService) ReadBundlePatch(profile, packageName string) *string {
	dir := s.resolveBundleDir(profile, packageName)
	if dir == "" {
		return nil
	}
	raw, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if err != nil {
		return nil
	}
	var manifest map[string]any
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return nil
	}
	dsh, _ := manifest["dsh"].(map[string]any)
	if dsh == nil {
		return nil
	}
	bundle, _ := dsh["bundle"].(map[string]any)
	if bundle == nil {
		return nil
	}
	patchRel, _ := bundle["patch"].(string)
	if patchRel == "" {
		return nil
	}
	content, err := os.ReadFile(filepath.Join(dir, patchRel))
	if err != nil {
		return nil
	}
	str := string(content)
	return &str
}

func isExecutable(path string) bool {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false
	}
	if runtime.GOOS == "windows" {
		return true
	}
	return info.Mode()&0o111 != 0
}

func dshName() string {
	if runtime.GOOS == "windows" {
		return "dsh.exe"
	}
	return "dsh"
}

func bunName() string {
	if runtime.GOOS == "windows" {
		return "bun.exe"
	}
	return "bun"
}

/** 在 PATH 上查找可执行文件（通用）。 */
func (s *DshService) findOnPath(name string) string {
	delim := ":"
	if runtime.GOOS == "windows" {
		delim = ";"
	}
	for _, dir := range strings.Split(os.Getenv("PATH"), delim) {
		if dir == "" {
			continue
		}
		candidates := []string{name}
		if runtime.GOOS == "windows" {
			candidates = []string{name + ".exe", name + ".cmd", name + ".bat"}
		}
		for _, cand := range candidates {
			full := filepath.Join(dir, cand)
			if isExecutable(full) {
				return full
			}
		}
	}
	return ""
}

/** 查找 bun 可执行文件（bun 安装的 dsh 无 node 时用它兜底解释执行）。 */
func (s *DshService) findBun() string {
	home, _ := os.UserHomeDir()
	bunBin := filepath.Join(home, ".bun", "bin", bunName())
	if isExecutable(bunBin) {
		return bunBin
	}
	return s.findOnPath("bun")
}

/** 解析 dsh 可执行文件：手动配置 > PATH > ~/.bun/bin（bun 全局安装目录）。 */
func (s *DshService) ResolveDshBin(configuredPath string) *string {
	if configuredPath != "" {
		if isExecutable(configuredPath) {
			return &configuredPath
		}
		return nil
	}
	if fromPath := s.findOnPath("dsh"); fromPath != "" {
		return &fromPath
	}
	home, _ := os.UserHomeDir()
	bunBin := filepath.Join(home, ".bun", "bin", dshName())
	if isExecutable(bunBin) {
		return &bunBin
	}
	return nil
}

/** 执行 `<bin> [prefix...] --version` 并返回首行版本号（10s 超时，注入用户 PATH）。 */
func runVersion(bin string, prefix []string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	args := append(append([]string{}, prefix...), "--version")
	c := exec.CommandContext(ctx, bin, args...)
	c.Env = userEnv(nil)
	out, err := c.CombinedOutput()
	if err != nil {
		return "", err
	}
	if c.ProcessState.ExitCode() != 0 {
		return "", fmt.Errorf("exit code %d", c.ProcessState.ExitCode())
	}
	version := strings.TrimSpace(strings.Split(string(out), "\n")[0])
	if version == "" {
		version = "unknown"
	}
	return version, nil
}

func describeVersionErr(err error) string {
	var ee *exec.ExitError
	if errors.As(err, &ee) {
		if stderr := strings.TrimSpace(string(ee.Stderr)); stderr != "" {
			return stderr[:min(len(stderr), 200)]
		}
		return fmt.Sprintf("exit code %d", ee.ExitCode())
	}
	return err.Error()
}

/**
 * 探测 dsh 的实际运行方式：
 * 1. 直接执行（注入用户 PATH，shebang 的 env node 可解析）；
 * 2. 失败（常见于只装 bun 未装 node）→ 用 bun 解释执行。
 */
func (s *DshService) probeDsh(binPath string) probeResult {
	if version, err := runVersion(binPath, nil); err == nil {
		return probeResult{ok: true, command: binPath, prefix: []string{}, version: version}
	} else {
		if bun := s.findBun(); bun != "" {
			if version, err := runVersion(bun, []string{binPath}); err == nil {
				return probeResult{ok: true, command: bun, prefix: []string{binPath}, version: version}
			}
		}
		return probeResult{ok: false, errMsg: describeVersionErr(err)}
	}
}

/** 解析并探测 dsh：手动配置 > PATH > ~/.bun/bin，随后探测运行方式。 */
func (s *DshService) ResolveDsh(configuredPath string) DshResolveResult {
	binPath := s.ResolveDshBin(configuredPath)
	if binPath == nil {
		if configuredPath != "" {
			return DshResolveResult{State: "invalid", Path: configuredPath, Error: "file-not-found"}
		}
		return DshResolveResult{State: "missing"}
	}
	probed := s.probeDsh(*binPath)
	if !probed.ok {
		return DshResolveResult{State: "invalid", Path: *binPath, Error: probed.errMsg}
	}
	return DshResolveResult{
		State:   "ok",
		Path:    *binPath,
		Command: probed.command,
		Prefix:  probed.prefix,
		Version: probed.version,
	}
}
