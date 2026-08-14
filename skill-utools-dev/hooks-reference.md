# 模板 Hooks & Utils 参考

## 存储 Hooks

### `useUtoolsDbStorage(key, initial)` 🌟 推荐

最常用的存储 hook。基于 `dbStorage`（类 localStorage），封装为 Vue Ref，自动持久化。

```ts
// 定义 key（在 src/global/LocalNameEnum.ts 中统一管理）
export enum LocalNameEnum {
  KEY_APP_COLLAPSED = '/key/app/collapsed',
  KEY_THEME = '/key/app/theme',
}

// 使用
const collapsed = useUtoolsDbStorage(LocalNameEnum.KEY_APP_COLLAPSED, false)
const theme = useUtoolsDbStorage<'light' | 'dark'>(LocalNameEnum.KEY_THEME, 'light')

// 读取/赋值自动同步到 dbStorage
collapsed.value = !collapsed.value
```

**类型**：
```ts
function useUtoolsDbStorage<T extends string | number | boolean | Record<string, any>>(
  key: string,
  initial: T | (() => T)
): Ref<T>
```

### `useUtoolsDbAsync(key, initial, options?)`

基于 `db.promises` 文档数据库，适合存储大对象，支持云端同步。

```ts
const settings = useUtoolsDbAsync('app-settings', {
  theme: 'auto',
  language: 'zh-CN'
})

// options
{
  flush?: 'pre' | 'post' | 'sync'  // 写时机，默认 'pre'
  deep?: boolean                     // 深度监听，默认 true
  writeDefaults?: boolean            // 初始写入默认值，默认 true
  onError?(e: any): void             // 错误处理
}
```

**类型**：
```ts
function useUtoolsDbAsync<T extends string | number | boolean | object | null>(
  key: string, initialValue: T, options?: UseUtoolsDbOptions
): Ref<T>
```

### `useUtoolsKvStorage(key, initial)`

轻量 KV 存储，与 `useUtoolsDbStorage` 类似但使用 customRef 实现。

```ts
const token = useUtoolsKvStorage('auth-token', '')
```

## Native Utils

位于 `src/utils/native/`，是对 `window.preload.inject` 的二次封装。

### `KeyValueUtil`

对 `dbStorage` 的简单包装。

```ts
KeyValueUtil.getItem<T>(key: string): T | null
KeyValueUtil.setItem<T>(key: string, value: T): void
KeyValueUtil.removeItem(key: string): void
```

### `DbStorageUtil` — 异步文档操作

对 `db.promises` 的高级封装，内置冲突重试。

```ts
// 列表操作
listByAsync<T>(key: string): Promise<{ list: T[]; rev?: string }>
saveListByAsync<T>(key: string, records: T[], rev?: string, retryCount?: number): Promise<string | undefined>
listRecordByAsync<T>(key?: string | string[]): Promise<{ id: string; record: T; rev?: string }[]>

// 单对象操作
getFromOneByAsync<T>(key: string): Promise<{ id: string; record: T | null; rev?: string }>
getFromOneWithDefaultByAsync<T>(key: string, defaultValue: T): Promise<{ id: string; record: T; rev?: string }>
saveOneByAsync<T>(key: string, value: T, rev?: string, retryCount?: number): Promise<string | undefined>
removeOneByAsync(key: string, ignoreError?: boolean): Promise<void>

// 批量操作
removeMultiByAsync(key: string, ignoreError?: boolean): Promise<void>

// 附件
postAttachment(docId: string, attachment: Blob | File): Promise<string>
```

> 内置冲突重试（`Document update conflict`）和克隆错误重试，无须调用方关心。

### `NativeUtil`

系统级便捷方法。

```ts
isDarkColors(): boolean                          // 系统暗色模式
getUserProfile(): { avatar: string; nickname: string; type: string }
copyText(text: string): void                     // 复制文本
```

## 其他 Hooks

### `ColorMode` — 暗色模式自动跟随

```ts
import { useColorMode } from '@/hooks/ColorMode'
// 自动跟随系统主题切换
```

### `UseSafeBack` — 安全返回

处理 uTools 插件返回逻辑。

### `MountEventBus` — 组件挂载事件总线

```ts
import { mountEventBus } from '@/hooks/MountEventBus'
```

### `AsyncDebounce` — 异步防抖

```ts
import { asyncDebounce } from '@/hooks/AsyncDebounce'
```

### `Snowflake` — 雪花 ID 生成

```ts
import { snowflake } from '@/hooks/Snowflake'
```

### `UseLog` — 日志工具

```ts
import { useLog } from '@/hooks/UseLog'
```

### `IntervalComputer` — 定时计算

```ts
import { useIntervalComputer } from '@/hooks/IntervalComputer'
```
