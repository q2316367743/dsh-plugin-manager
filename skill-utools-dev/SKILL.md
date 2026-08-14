---
name: utools-vite-template
description: |
  uTools 插件开发模板 —— Vite + Vue3 + TDesign + UnoCSS + Pinia + TypeScript。
  
  触发场景：
  - 使用本模板开发/维护 uTools 插件
  - 新增功能指令（feature）或 preload API
  - 使用模板内置的存储方案、窗口控制、AI 调用等能力
  - 打包/发布 uTools 插件
  
  触发词：uTools、utools、插件开发、plugin.json、preload、功能指令、feature、dbStorage、onPluginEnter、useUtoolsDbStorage
---

# uTools Vite 插件开发模板

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 构建 | Vite 8 | HMR 开发、`src/` → `src-utools/dist/` |
| 框架 | Vue 3 + Composition API | `<script setup lang="ts">` |
| UI | TDesign Vue Next | 组件 + 图标，Fluent Design 风格 |
| CSS | UnoCSS（布局）+ TDesign Token（颜色） | 禁止裸色值 |
| 状态 | Pinia | |
| 路由 | Vue Router（Hash 模式） | uTools 环境必须用 hash |
| 类型 | TypeScript strict | 禁止 `any` |

## 架构

```
┌────────────────────────────────────────────┐
│            src/ （Vite 编译）                │
│  App.vue → pages/ → hooks/ → utils/        │
│       │                                     │
│       │ 调用 window.preload.inject.xxx()    │
│       ▼                                     │
│  src/vite-env.d.ts  ← 类型声明              │
└──────────────┬─────────────────────────────┘
               │ 构建输出到
               ▼
┌────────────────────────────────────────────┐
│       src-utools/ （不编译，直接打包）        │
│  plugin.json  ← uTools 入口配置              │
│  preload.js   ← require('./src/inject')     │
│  src/inject.js ← 全部 uTools API 封装        │
│  src/net.js   ← Node.js 网络能力             │
│  dist/        ← Vite 构建产物                │
└────────────────────────────────────────────┘
```

**核心约定**：前端永远只通过 `window.preload.inject` 调用底层能力，不直接接触 utools/ZTools API。inject 层屏蔽了三平台差异（utools / ZTools / browser）。

## 目录结构速查

```
src/
├── pages/           # 页面组件（每个页面一个目录）
│   └── home/        #   index.vue + components/ + modals/
├── components/      # 跨页面公共组件
├── hooks/           # 组合式函数（存储、工具等）
├── utils/
│   └── native/      # 存储二次封装（DbStorageUtil、KeyValueUtil、NativeUtil）
├── global/          # Constant.ts、LocalNameEnum.ts
├── store/           # Pinia stores
├── plugin/router.ts # 路由配置
└── types/           # inject.d.ts 等类型声明

src-utools/
├── plugin.json      # uTools 核心配置
├── preload.js       # 预加载脚本入口 → 挂载 window.preload
├── src/
│   ├── inject.js    # 所有 uTools API 的统一封装
│   └── net.js       # Node.js 网络模块
└── dist/            # pnpm build 产物
```

## 开发工作流

### 1. 启动开发

```bash
pnpm dev          # 启动 Vite dev server → http://localhost:5173
```

uTools 加载项目时，`plugin.json` → `development.main` 指向 dev server，支持 HMR。

### 2. 构建

```bash
pnpm build        # vue-tsc 类型检查 + vite build → src-utools/dist/
```

### 3. 打包插件

在 uTools 中右键插件 → "打包为离线安装包"，或直接打包 `src-utools/` 目录为 `.upx`。

---

## plugin.json 配置要点

```json
{
  "main": "dist/index.html",          // 生产入口
  "preload": "preload.js",            // 预加载脚本
  "logo": "public/logo.png",          // 插件图标
  "development": {
    "main": "http://localhost:5173/"  // 开发入口 → HMR
  },
  "pluginSetting": {
    "single": true,                   // 单例模式
    "height": 0                       // 0 = 自适应高度
  },
  "features": [{                      // 功能指令集
    "code": "launch",                 //   功能编码（进入时传入）
    "explain": "描述",
    "cmds": ["vite", "模板"],          //   触发指令
    "icon": "public/logo.png"
  }]
}
```

### 六种指令类型

| 指令写法 | 类型 | 触发方式 | payload 内容 |
|---------|------|---------|-------------|
| `"vite"` | 功能指令 | 搜索框输入 "vite" | `string`（用户输入） |
| `{ type:"regex", match:"/^https?:\\/\\//i", label:"打开链接" }` | 正则匹配 | 匹配正则的文本 | `string` |
| `{ type:"over", label:"百度一下" }` | 任意文本 | 匹配任意输入 | `string` |
| `{ type:"img", label:"文字识别" }` | 图像 | 粘贴/拖入图片 | `base64` |
| `{ type:"files", fileType:"file", extensions:["png"], label:"处理图片" }` | 文件 | 拖入匹配文件 | `{isFile,isDirectory,name,path}[]` |
| `{ type:"window", match:{app:["chrome.exe"]}, label:"置顶" }` | 窗口 | 匹配活动窗口 | 窗口信息 |

> 正则中斜杠需双写：`\\/` 而非 `\/`

### 正则实用模板

```json
// URL
"/^(?:(http|https|ftp):\\/\\/)?((?:[\\w-]+\\.)+[a-z0-9]+)((?:\\/[^\\/?#]*)+)?(\\?[^#]+)?(#.+)?$/i"

// 身份证
"/^[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}(\\d|X)$/"

// 手机号
"/^1[3456789]\\d{9}$/"
```

---

## 功能指令处理流程

用户输入 → uTools 匹配 feature.cmds → 进入插件 → 触发 `onPluginEnter`：

```ts
// 在 App.vue 或页面入口
window.preload.inject.onPluginEnter((action) => {
  const { code, type, payload, from } = action

  switch (code) {
    case 'my-feature':
      // 根据 type 处理 payload
      if (type === 'text') handleText(payload)
      if (type === 'files') handleFiles(payload)
      break
  }
})
```

`action.from` 可区分进入方式：`'main'` | `'panel'` | `'hotkey'` | `'redirect'`

---

## 新增 preload API

三步流程：

**1. 写 CommonJS 模块** (`src-utools/src/mylib.js`)：
```js
const fs = require('node:fs')
module.exports = {
  readConfig: (p) => JSON.parse(fs.readFileSync(p, 'utf-8'))
}
```

**2. 挂载到 window.preload** (`src-utools/preload.js`)：
```js
const mylib = require('./src/mylib')
window.preload = { ...window.preload, mylib }
```

**3. 声明类型** (`src/vite-env.d.ts`)：
```ts
interface Window {
  preload: {
    // ... 已有
    mylib: {
      readConfig(path: string): Record<string, any>
    }
  }
}
```

然后 Vue 组件中直接 `window.preload.mylib.readConfig(...)`，有完整类型提示。

---

## 新增页面 + 路由

**1. 创建页面** `src/pages/settings/index.vue`：
```vue
<template>
  <div class="p-4">设置页</div>
</template>
```

**2. 注册路由** `src/plugin/router.ts`：
```ts
import { SettingIcon } from 'tdesign-icons-vue-next'

export const routes = [
  // ... 已有路由
  {
    name: "设置",
    path: '/settings',
    component: () => import('@/pages/settings/index.vue'),
    meta: { icon: SettingIcon }   // 侧边栏图标
  }
]
```

侧边栏菜单从 `routes` 自动渲染，`meta.hidden = true` 可隐藏。

---

## 窗口操作常用场景

```ts
const w = window.preload.inject.window

// 调整窗口高度
w.setExpendHeight(800)

// 隐藏窗口 + 粘贴文本到系统
w.hideMainWindowPasteText('复制的内容')

// 隐藏窗口 + 粘贴文件
w.hideMainWindowPasteFile('/path/to/file.png')

// 隐藏窗口 + 输入文本（模拟键盘）
w.hideMainWindowTypeString('hello')

// 隐藏窗口并恢复之前窗口
w.hideMainWindow(true)

// 拖拽文件
w.startDrag('/path/to/file.png')
```

---

## 数据存储方案速查

| 方案 | 底层 | 适合场景 | 用法 |
|------|------|---------|------|
| `useUtoolsDbStorage` | dbStorage（类 localStorage） | 设置项、开关、小数据 | `useUtoolsDbStorage(key, false)` |
| `useUtoolsDbAsync` | db.promises（文档 DB） | 大对象、需云端同步 | `useUtoolsDbAsync(key, {})` |
| `useUtoolsKvStorage` | dbStorage | 轻量 KV | `useUtoolsKvStorage(key, '')` |
| `DbStorageUtil` | db.promises | 列表/附件/高级操作 | `saveOneByAsync(key, data, rev)` |

**Key 管理**：持久化 key 统一在 `src/global/LocalNameEnum.ts` 中定义。

---

## 代码约束（AGENTS.md 红线）

| # | 规则 |
|---|------|
| RL-01 | 对外输出使用中文 |
| RL-02 | 根目录不放业务代码 |
| RL-03 | API 层隔离：组件经 `@/api` 或 `window.preload.inject` 访问后端 |
| RL-04 | 禁止 `any`；禁止不必要的 `as` 断言 |
| RL-05 | UI 必须用 TDesign；禁止原生 `alert` / `select` |
| RL-06 | vue ≤ 300 行，ts ≤ 500 行 |

**设计约定**：
- Fluent Design 风格（层级、阴影、动效）
- 颜色必须用 TDesign CSS Token（禁止裸色值）
- 弹窗/抽屉必须用 `.tsx` 实现
- 页面私有组件放 `pages/xxx/components/`，公共组件才放 `src/components/`

---

## API 完整参考

所有 `window.preload.inject` 的 API 文档见：
→ [api-reference.md](./api-reference.md)（含 20+ 模块的完整签名和示例）

Hooks 和 Utils 参考见：
→ [hooks-reference.md](./hooks-reference.md)
