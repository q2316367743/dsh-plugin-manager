# 02 · 多平台打包发布

DSH 插件管理器的多平台打包 / 签名 / 自动更新发布流程（v1.0.0 执行记录，下个版本照此执行）。

## 一、产物清单

| 文件（`bin/` 下）                        | 平台        | 用途                                                           |
|------------------------------------------|-------------|----------------------------------------------------------------|
| `dsh-plugin-manager-amd64-installer.exe` | Windows x64 | NSIS 安装包（用户安装）                                        |
| `dsh-plugin-manager-darwin-arm64.dmg`    | macOS arm64 | **用户安装包**（拖入 Applications；`hdiutil verify` 通过）     |
| `dsh-plugin-manager-darwin-amd64.dmg`    | macOS amd64 | 同上                                                           |
| `dsh-plugin-manager-darwin-arm64.zip`    | macOS arm64 | **自动更新产物**（内含签名后的 `.app`，单一顶层条目）          |
| `dsh-plugin-manager-darwin-amd64.zip`    | macOS amd64 | 同上                                                           |
| `dsh-plugin-manager-windows-amd64.zip`   | Windows x64 | 自动更新产物（内含 `dsh-plugin-manager.exe`）                  |
| `update.json`                            | —           | 更新清单（schemaVersion 1，含 sha512 digest + ed25519ph 签名；**只列 zip**，dmg 不进清单） |

**dmg 与 zip 的分工**：更新器（`pkg/updater`）只支持 zip / tar.gz 解压、不支持 dmg，所以自动更新必须用 zip；dmg 是给用户手动下载安装的（拖拽到 Applications 的标准分发体验）。两者都上传，`update.json` 只引用 zip。

## 二、上传位置

应用轮询的清单地址固定在 `https://static.esion.xyz/public/static/wails/dsh-plugin-manager/update.json`（`main.go` 的
`updateManifestURL`），故：

```
https://static.esion.xyz/public/static/wails/dsh-plugin-manager/
├── update.json                          ← 上传到这里（父目录，覆盖旧版）
└── 1.0.0/                               ← 版本目录（= info.version）
    ├── dsh-plugin-manager-darwin-arm64.dmg      ← 用户下载页入口
    ├── dsh-plugin-manager-darwin-amd64.dmg
    ├── dsh-plugin-manager-amd64-installer.exe   ← 用户下载页入口（Windows）
    ├── dsh-plugin-manager-darwin-arm64.zip      ← 自动更新产物（update.json 引用）
    ├── dsh-plugin-manager-darwin-amd64.zip
    └── dsh-plugin-manager-windows-amd64.zip
```

`update.json` 中 `artifacts[].url` 为相对路径（`1.0.0/xxx.zip`），由服务端按清单所在位置解析，与上图布局一致。

## 三、打包全流程

### 0. 准备

- 确保 `wails3` 在 PATH：`export PATH="$HOME/go/bin:$PATH"`（本机位于 `~/go/bin`）。
- 修改 `build/config.yml` 的 `info.version`（ **版本唯一来源**，应用运行时解析它作为 `CurrentVersion`）。
- 重新生成构建资产（同步 Info.plist / windows info.json 的名称、bundle id、版本）：
  ```
  wails3 task common:update:build-assets
  ```
- 交叉编译 Windows 无需 Docker（`CGO_ENABLED=0` 原生交叉编译）；打 NSIS 安装包需本机有 `makensis`（`brew install makensis`）。

### 1. macOS arm64

```
wails3 task darwin:package        # 构建 + 组装 .app（默认 adhoc 签名）
```

### 2. macOS amd64

```
wails3 task darwin:build ARCH=amd64
# 组装 amd64 版 .app（与 create:app:bundle 等价，命名区分避免覆盖 arm64 产物）：
rm -rf bin/dsh-plugin-manager-amd64.app
mkdir -p bin/dsh-plugin-manager-amd64.app/Contents/{MacOS,Resources}
cp bin/dsh-plugin-manager bin/dsh-plugin-manager-amd64.app/Contents/MacOS/
cp build/darwin/icons.icns bin/dsh-plugin-manager-amd64.app/Contents/Resources/
cp build/darwin/Info.plist bin/dsh-plugin-manager-amd64.app/Contents/
codesign --force --deep --sign - bin/dsh-plugin-manager-amd64.app
```

### 3. Windows x64

```
wails3 task windows:build ARCH=amd64       # bin/dsh-plugin-manager.exe
wails3 task windows:package ARCH=amd64     # bin/dsh-plugin-manager-amd64-installer.exe
```

### 4. 制作自动更新 zip

**关键约束**：更新器解包要求 zip **恰好一个顶层条目**（见 `pkg/updater/extract.go`），禁止 `__MACOSX/` / AppleDouble（`._`
）文件，否则拒绝安装。mac 用 `zip -r -y -X`（保留符号链接、剔除扩展属性），win 用 `zip -X`，且 zip 前必须删除旧包（`zip`
会向已有归档追加，导致多顶层条目）：

```
rm -rf /tmp/pkg && mkdir -p /tmp/pkg/{darwin-arm64,darwin-amd64,win}
cp -R bin/dsh-plugin-manager.app      /tmp/pkg/darwin-arm64/dsh-plugin-manager.app
cp -R bin/dsh-plugin-manager-amd64.app /tmp/pkg/darwin-amd64/dsh-plugin-manager.app
cp bin/dsh-plugin-manager.exe         /tmp/pkg/win/dsh-plugin-manager.exe
rm -f bin/*.zip
(cd /tmp/pkg/darwin-arm64 && zip -q -r -y -X ../../..<repo>/bin/dsh-plugin-manager-darwin-arm64.zip dsh-plugin-manager.app)
(cd /tmp/pkg/darwin-amd64 && zip -q -r -y -X ../../..<repo>/bin/dsh-plugin-manager-darwin-amd64.zip dsh-plugin-manager.app)
(cd /tmp/pkg/win && zip -q -X ../../..<repo>/bin/dsh-plugin-manager-windows-amd64.zip dsh-plugin-manager.exe)
# 自检：unzip -Z1 <zip> | awk -F/ '{print $1}' | sort -u 应只有 dsh-plugin-manager.app / dsh-plugin-manager.exe
```

### 4.5 制作 dmg（用户安装包）

`wails3 tool package --format dmg` 按 `bin/{name}.app` 取应用，双架构需临时替换再还原；产物按架构重命名：

```
# arm64（bin/dsh-plugin-manager.app 即 arm64）
wails3 tool package --format dmg --name dsh-plugin-manager --out bin \
  --background build/darwin/dmg-background.png \
  --volume-icon build/darwin/icons.icns --file-icon build/darwin/dmg-file-icon.icns \
  --window-width 540 --window-height 380
mv bin/dsh-plugin-manager.dmg bin/dsh-plugin-manager-darwin-arm64.dmg

# amd64：临时把 amd64 .app 换到标准名，打完再换回
mv bin/dsh-plugin-manager.app bin/dsh-plugin-manager-arm64.app.tmp
mv bin/dsh-plugin-manager-amd64.app bin/dsh-plugin-manager.app
wails3 tool package --format dmg --name dsh-plugin-manager --out bin \
  --background build/darwin/dmg-background.png \
  --volume-icon build/darwin/icons.icns --file-icon build/darwin/dmg-file-icon.icns \
  --window-width 540 --window-height 380
mv bin/dsh-plugin-manager.dmg bin/dsh-plugin-manager-darwin-amd64.dmg
mv bin/dsh-plugin-manager.app bin/dsh-plugin-manager-amd64.app
mv bin/dsh-plugin-manager-arm64.app.tmp bin/dsh-plugin-manager.app

# 自检：hdiutil verify bin/dsh-plugin-manager-darwin-{arm64,amd64}.dmg → checksum VALID
```

### 5. 生成并验证 update.json

文件名必须含 GOOS + GOARCH（`darwin` / `windows` + `arm64` / `amd64`），命令据此推断平台：

```
mkdir -p /tmp/release && cp bin/dsh-plugin-manager-{darwin-arm64,darwin-amd64,windows-amd64}.zip /tmp/release/
wails3 updater manifest -version 1.0.0 -name "DSH Plugin Manager" \
  -key updater.key -url-prefix "1.0.0/" -output bin/update.json /tmp/release
wails3 updater verify -manifest bin/update.json -publickey updater.key.pub -dir /tmp/release
# 期望输出：每个产物 digest ok, signature ok
```

`-key updater.key` 会对每个产物计算 sha512 digest 并做 ed25519ph 签名；客户端用内嵌公钥（`main.go` 的 `publicKey`
）验签，fail-closed。`-url-prefix 1.0.0/` 生成相对 URL。

## 四、mac 签名与公证

### v1.0.0 状态：签名已完成，公证待凭据

- 已用 **Developer ID Application: Shengda Qiao (PNP35F7Q7P)** 签名两个架构的 `.app`（`--hardened-runtime` 硬运行时）：
  ```
  wails3 tool sign --input bin/dsh-plugin-manager.app \
    --identity "Developer ID Application: Shengda Qiao (PNP35F7Q7P)" --hardened-runtime
  ```
- 验证结果：`codesign --verify --deep --strict` 通过；`Authority=Developer ID Application → Developer ID Certification Authority → Apple Root CA`；`spctl` 报 `Unnotarized Developer ID` 属预期（未公证前 Gatekeeper 会拦截）。
- **公证未做**：`notarytool store-credentials` 尚未执行（需要 Apple ID + app 专用密码）。步骤见下。

### 历史问题：errSecInternalComponent（已绕过）

旧证书（`3rd Party Mac Developer Application`）私钥 ACL 限制 codesign 无 GUI 确认时访问，报 `errSecInternalComponent`；新申请的 Developer ID 私钥无此问题，直接签名成功。若以后仍需用旧身份签名，可修复 ACL（需钥匙串密码）：

```
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k <钥匙串密码> ~/Library/Keychains/login.keychain-db
```

### 公证（待凭据，拿到后执行）

```
# 一次性保存凭据（Apple ID + app 专用密码，在 appleid.apple.com 生成）
xcrun notarytool store-credentials dsh-updater \
  --apple-id <你的 Apple ID> --team-id PNP35F7Q7P --password <app 专用密码>
# 签名 + 公证 + 装订（对两个架构分别执行）
wails3 tool sign --input bin/dsh-plugin-manager.app \
  --identity "Developer ID Application: Shengda Qiao (PNP35F7Q7P)" \
  --notarize --keychain-profile dsh-updater
wails3 tool sign --input bin/dsh-plugin-manager-amd64.app \
  --identity "Developer ID Application: Shengda Qiao (PNP35F7Q7P)" \
  --notarize --keychain-profile dsh-updater
# 验证：spctl -a -vv --type execute bin/dsh-plugin-manager.app → accepted
```

### 签名后重新打包

签名 / 公证会替换 `.app` 内嵌签名 → 产物 digest 变化，必须重做「三、4 制作 zip」「三、4.5 制作 dmg」「三、5 生成 update.json」三节，再上传。

## 五、注意事项

1. **zip 单一顶层条目**是硬性要求；`ditto` 生成的 `__MACOSX` 会被拒绝，务必用 `zip -r -y -X` 并在 zip 前删除旧归档。
2. **更新器只支持 zip / tar.gz** 解压（不支持 dmg），mac 更新产物必须打包 `.app` 而非 dmg。
3. `version` 需 **大于当前运行版本**（semver 比较）才触发更新；清单 404/204 视为「无更新」。
4. **`updater.key` 私钥务必备份**（CI secret / 密码管理器），丢失后无法再签发新版本；`.pub` 与代码内嵌公钥一致。
5. Windows 安装包与自动更新产物分离：NSIS 安装器只做用户手动安装，自动更新走 `dsh-plugin-manager-windows-amd64.zip`（内含裸
   exe，更新器交换目标即 exe）。
6. 跨平台编译依赖：`services/proc.go` 的 Unix 系统调用已拆分为 `proc_unix.go`（`!windows`）/ `proc_windows.go`（`windows`
   ）——新增平台相关代码时注意保持两个文件签名一致。
