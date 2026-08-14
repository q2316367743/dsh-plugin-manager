# 文档索引

| 编号 | 标题 | 描述 |
|---|---|---|
| [01](01-plugin-manager.md) | DSH 插件管理器 | Wails v3 桌面应用：按 profile 管理 dsh 插件的启停 / 直装 / 更新（可中断 + ANSI 控制台）/ 纯净模式 / web 服务（默认浏览器 or 内置浏览器窗口打开，宽高可配）/ 配置 / 系统托盘；含应用自动更新（endpoint 静态清单 + Ed25519 签名验证 + 周期检查 + 重启确认）；Go 服务契约（含 BrowserService）、事件协议（proc:output / proc:exit / tray:* / app:update-*）与边界注意事项 |
| [02](02-packaging.md) | 多平台打包发布 | v1.0.0 打包记录：mac arm64 / amd64 + Windows x64 的构建、.app 组装、NSIS 安装包、dmg 用户安装包、自动更新 zip 制作（单一顶层条目约束）、update.json 生成与签名验证、上传目录布局；mac 签名（Developer ID Application + 硬运行时，已签）与公证（待凭据）步骤 |
