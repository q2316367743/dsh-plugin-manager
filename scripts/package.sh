#!/usr/bin/env bash
# scripts/package.sh —— 一键生成全部 7 个发布产物（流程见 docs/02-packaging.md 第三节）
#
#   1. dsh-plugin-manager-amd64-installer.exe   Windows x64 NSIS 安装包
#   2. dsh-plugin-manager-darwin-arm64.dmg      macOS arm64 用户安装包
#   3. dsh-plugin-manager-darwin-amd64.dmg      macOS amd64 用户安装包
#   4. dsh-plugin-manager-darwin-arm64.zip      macOS arm64 自动更新产物（单一顶层条目）
#   5. dsh-plugin-manager-darwin-amd64.zip      macOS amd64 自动更新产物（单一顶层条目）
#   6. dsh-plugin-manager-windows-amd64.zip     Windows x64 自动更新产物（含裸 exe）
#   7. update.json                              更新清单（只引用 zip，不含 dmg）
#
# 版本唯一来源：build/config.yml 的 info.version（应用运行时同样解析它）。
# 签名：默认 adhoc；SIGN=1 时先用 Developer ID 签名两个 .app（--hardened-runtime）
#       再打包（签名会改变 digest，必须先于 zip / dmg / update.json）。
# 公证：NOTARIZE=1（需与 SIGN=1 同用）在签名后提交 Apple 公证并装订，
#       凭据用 keychain profile（NOTARY_PROFILE 环境变量，默认 dsh-updater）：
#         xcrun notarytool store-credentials dsh-updater \
#           --apple-id <Apple ID> --team-id PNP35F7Q7P --password <app 专用密码>
#
# 用法：
#   scripts/package.sh                     # adhoc 签名（本地自测）
#   SIGN=1 scripts/package.sh              # Developer ID 签名（身份取 wails3 setup 默认）
#   DEV_ID="Developer ID Application: XXX" SIGN=1 scripts/package.sh            # 签名
#   DEV_ID="..." SIGN=1 NOTARIZE=1 scripts/package.sh                           # 签名 + 公证

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$SCRIPT_DIR")"
cd "$REPO"

export PATH="$HOME/go/bin:$PATH"

# ── 0. 准备：解析版本 / 产品名，检查工具链 ──────────────────────────
VERSION="$(sed -nE 's/^[[:space:]]+version:[[:space:]]*"([^"]+)".*/\1/p' build/config.yml | head -1)"
PRODUCT_NAME="$(sed -nE 's/^[[:space:]]+productName:[[:space:]]*"([^"]+)".*/\1/p' build/config.yml | head -1)"
if [ -z "$VERSION" ]; then
  echo "✗ 无法从 build/config.yml 解析 info.version" >&2
  exit 1
fi

for tool in wails3 makensis zip unzip hdiutil codesign; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "✗ 缺少 $tool（mac 需 brew install makensis）" >&2
    exit 1
  fi
done
if [ ! -f updater.key ] || [ ! -f updater.key.pub ]; then
  echo "✗ 缺少 updater.key / updater.key.pub（wails3 updater genkey 产物，勿入库）" >&2
  exit 1
fi

echo "======================================================"
echo " dsh 助手 一键打包  版本 ${VERSION}"
echo "======================================================"

# 清空 bin/，保证产物可复现（bin 已在 .gitignore，全部重新生成）
rm -rf bin && mkdir -p bin

# 临时目录：zip 打包 / update.json 校验的暂存区，退出自动清理
STAGE="$(mktemp -d /tmp/dsh-package.XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT

# ── 1. 同步构建资产（Info.plist / windows info.json 的名称、bundle id、版本）──
echo "==> [1/7] wails3 task common:update:build-assets"
wails3 task common:update:build-assets

# ── 2. macOS arm64：构建 + 组装 .app（默认 adhoc 签名）─────────────
echo "==> [2/7] macOS arm64：wails3 task darwin:package"
wails3 task darwin:package

# ── 3. macOS amd64：构建 + 手动组装 amd64 .app ────────────────────
echo "==> [3/7] macOS amd64：darwin:build ARCH=amd64 + 组装 amd64 .app"
wails3 task darwin:build ARCH=amd64
rm -rf bin/dsh-plugin-manager-amd64.app
mkdir -p bin/dsh-plugin-manager-amd64.app/Contents/MacOS
mkdir -p bin/dsh-plugin-manager-amd64.app/Contents/Resources
cp bin/dsh-plugin-manager bin/dsh-plugin-manager-amd64.app/Contents/MacOS/
cp build/darwin/icons.icns bin/dsh-plugin-manager-amd64.app/Contents/Resources/
cp build/darwin/Info.plist bin/dsh-plugin-manager-amd64.app/Contents/
codesign --force --deep --sign - bin/dsh-plugin-manager-amd64.app

# ── 4. Windows x64：构建 + NSIS 安装包 ────────────────────────────
echo "==> [4/7] Windows x64：windows:build + windows:package（NSIS）"
wails3 task windows:build ARCH=amd64
wails3 task windows:package ARCH=amd64

# ── 4.5 可选：Developer ID 签名 + 公证（文档第四节）─────────────
if [ "${NOTARIZE:-0}" = "1" ] && [ "${SIGN:-0}" != "1" ]; then
  echo "✗ NOTARIZE=1 需要与 SIGN=1 一起使用" >&2
  exit 1
fi
if [ "${SIGN:-0}" = "1" ]; then
  if [ "${NOTARIZE:-0}" = "1" ]; then
    echo "==> [4.5] Developer ID 签名 + 公证两个 .app（--hardened-runtime --notarize）"
  else
    echo "==> [4.5] Developer ID 签名两个 .app（--hardened-runtime）"
  fi
  SIGN_ARGS=(--hardened-runtime)
  if [ -n "${DEV_ID:-}" ]; then
    SIGN_ARGS+=(--identity "$DEV_ID")
  fi
  if [ "${NOTARIZE:-0}" = "1" ]; then
    SIGN_ARGS+=(--notarize --keychain-profile "${NOTARY_PROFILE:-dsh-updater}")
  fi
  wails3 tool sign --input bin/dsh-plugin-manager.app "${SIGN_ARGS[@]}"
  wails3 tool sign --input bin/dsh-plugin-manager-amd64.app "${SIGN_ARGS[@]}"
fi

# ── 5. 自动更新 zip（硬性约束：恰好一个顶层条目，无 __MACOSX/AppleDouble）──
echo "==> [5/7] 制作自动更新 zip"
mkdir -p "$STAGE"/{darwin-arm64,darwin-amd64,win}
cp -R bin/dsh-plugin-manager.app        "$STAGE/darwin-arm64/dsh-plugin-manager.app"
cp -R bin/dsh-plugin-manager-amd64.app "$STAGE/darwin-amd64/dsh-plugin-manager.app"
cp bin/dsh-plugin-manager.exe           "$STAGE/win/dsh-plugin-manager.exe"
# 剔除 Finder 可能写入的 .DS_Store，避免污染归档
find "$STAGE" -name '.DS_Store' -delete
# zip 会向已有归档追加导致多顶层条目，必须先删旧包
rm -f bin/*.zip
(cd "$STAGE/darwin-arm64" && zip -q -r -y -X "$REPO/bin/dsh-plugin-manager-darwin-arm64.zip" dsh-plugin-manager.app)
(cd "$STAGE/darwin-amd64" && zip -q -r -y -X "$REPO/bin/dsh-plugin-manager-darwin-amd64.zip" dsh-plugin-manager.app)
(cd "$STAGE/win"          && zip -q -X "$REPO/bin/dsh-plugin-manager-windows-amd64.zip" dsh-plugin-manager.exe)

check_zip() {
  local zip="$1" expected="$2"
  local tops
  tops="$(unzip -Z1 "$zip" | awk -F/ 'NF {print $1}' | sort -u)"
  if [ "$tops" != "$expected" ]; then
    echo "✗ $zip 顶层条目异常：$tops（期望 $expected）" >&2
    return 1
  fi
  if unzip -Z1 "$zip" | grep -Eq '(^|/)__MACOSX(/|$)|(^|/)\._'; then
    echo "✗ $zip 包含 __MACOSX 或 AppleDouble 文件" >&2
    return 1
  fi
  echo "  ✓ $zip 顶层条目 = $expected，无 AppleDouble"
}
check_zip bin/dsh-plugin-manager-darwin-arm64.zip dsh-plugin-manager.app
check_zip bin/dsh-plugin-manager-darwin-amd64.zip dsh-plugin-manager.app
check_zip bin/dsh-plugin-manager-windows-amd64.zip dsh-plugin-manager.exe

# ── 6. dmg 用户安装包（双架构：临时替换标准 .app 名）───────────────
echo "==> [6/7] 制作 dmg"
DMG_ARGS=(--format dmg --name dsh-plugin-manager --out bin
  --background build/darwin/dmg-background.png
  --volume-icon build/darwin/icons.icns --file-icon build/darwin/dmg-file-icon.icns
  --window-width 540 --window-height 380)

# arm64：bin/dsh-plugin-manager.app 即 arm64
wails3 tool package "${DMG_ARGS[@]}"
mv bin/dsh-plugin-manager.dmg bin/dsh-plugin-manager-darwin-arm64.dmg

# amd64：临时把 amd64 .app 换到标准名，打完再换回
mv bin/dsh-plugin-manager.app bin/dsh-plugin-manager-arm64.app.tmp
mv bin/dsh-plugin-manager-amd64.app bin/dsh-plugin-manager.app
wails3 tool package "${DMG_ARGS[@]}"
mv bin/dsh-plugin-manager.dmg bin/dsh-plugin-manager-darwin-amd64.dmg
mv bin/dsh-plugin-manager.app bin/dsh-plugin-manager-amd64.app
mv bin/dsh-plugin-manager-arm64.app.tmp bin/dsh-plugin-manager.app

# 自检：hdiutil verify → checksum VALID
hdiutil verify bin/dsh-plugin-manager-darwin-arm64.dmg
hdiutil verify bin/dsh-plugin-manager-darwin-amd64.dmg

# ── 7. 生成并验证 update.json（只引用 zip）─────────────────────────
echo "==> [7/7] 生成并验证 update.json"
mkdir -p "$STAGE/release"
cp bin/dsh-plugin-manager-{darwin-arm64,darwin-amd64,windows-amd64}.zip "$STAGE/release/"
wails3 updater manifest -version "$VERSION" -name "$PRODUCT_NAME" \
  -key updater.key -url-prefix "$VERSION/" -output bin/update.json "$STAGE/release"
wails3 updater verify -manifest bin/update.json -publickey updater.key.pub -dir "$STAGE/release"

# ── 汇总 ─────────────────────────────────────────────────────────
echo
echo "======================================================"
echo " ✅ 7 个发布产物已生成（版本 $VERSION）"
echo "======================================================"
ls -lh bin/dsh-plugin-manager-amd64-installer.exe \
      bin/dsh-plugin-manager-darwin-arm64.dmg \
      bin/dsh-plugin-manager-darwin-amd64.dmg \
      bin/dsh-plugin-manager-darwin-arm64.zip \
      bin/dsh-plugin-manager-darwin-amd64.zip \
      bin/dsh-plugin-manager-windows-amd64.zip \
      bin/update.json

cat <<EOF

上传位置：https://static.esion.xyz/public/static/wails/dsh-plugin-manager/
  update.json → 父目录（覆盖旧版）
  $VERSION/   → 其余 6 个文件（dmg / installer 为下载页入口，zip 供自动更新）
EOF

if [ "${SIGN:-0}" != "1" ]; then
  echo "提示：本次为 adhoc 签名，仅本地自测；对外分发请用 SIGN=1 scripts/package.sh（需先 wails3 setup 配默认身份或 DEV_ID 指定身份）。"
fi
if [ "${SIGN:-0}" = "1" ] && [ "${NOTARIZE:-0}" != "1" ]; then
  echo "提示：已签名未公证，Gatekeeper 仍会拦截；公证请用 NOTARIZE=1（需先执行 notarytool store-credentials，见 docs/02-packaging.md 第四节）。"
fi
