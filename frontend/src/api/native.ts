/**
 * 原生能力适配层：统一封装 Wails 前端 runtime（对话框 / 剪贴板 / 打开外链）
 * 与 KV 服务绑定，替代原 utools inject 注入面。
 * 组件 / store 一律经本模块访问原生能力（RL-03），禁止直接触碰 runtime。
 */
import { Browser, Clipboard, Dialogs } from '@wailsio/runtime'
import { BrowserService, KVService } from '../../bindings/dsh-plugin-manager/services'

/** 文件选择过滤器（与原 utools dialog 选项兼容） */
export interface NativeFileFilter {
  name: string
  extensions: string[]
}

export interface NativeDialogOptions {
  title?: string
  defaultPath?: string
  filters?: NativeFileFilter[]
  /**
   * 原 utools dialog properties，仅识别：
   * openFile / openDirectory / multiSelections / showHiddenFiles / createDirectory
   */
  properties?: string[]
}

type OpenDialogOptions = Parameters<typeof Dialogs.OpenFile>[0]

function mapFilters(filters?: NativeFileFilter[]) {
  if (!filters?.length) return undefined
  return filters.map((f) => ({
    DisplayName: f.name,
    Pattern: f.extensions.map((e) => (e.startsWith('*') ? e : `*.${e}`)).join(';')
  }))
}

function splitDefaultPath(defaultPath?: string): { directory?: string; filename?: string } {
  if (!defaultPath) return {}
  const idx = defaultPath.lastIndexOf('/')
  if (idx < 0) return { filename: defaultPath }
  return { directory: defaultPath.slice(0, idx), filename: defaultPath.slice(idx + 1) }
}

function hasProperty(properties: string[] | undefined, name: string): boolean {
  return properties?.includes(name) ?? false
}

export const nativeApi = {
  shell: {
    openExternal: async (url: string): Promise<void> => {
      await Browser.OpenURL(url)
    }
  },

  browser: {
    /** 在内置浏览器窗口打开 url（窗口已存在则聚焦复用） */
    openInBuiltin: async (url: string, width: number, height: number): Promise<void> => {
      await BrowserService.OpenInBuiltin(url, width, height)
    }
  },

  clipboard: {
    copyText: async (text: string): Promise<void> => {
      await Clipboard.SetText(text)
    },
    /** 读取系统剪贴板文本（读取失败返回空串） */
    readText: async (): Promise<string> => {
      try {
        return (await Clipboard.Text()) ?? ''
      } catch {
        return ''
      }
    }
  },

  dialog: {
    /** 打开文件 / 目录选择框，返回选中路径列表（取消返回空数组） */
    async open(options: NativeDialogOptions = {}): Promise<string[]> {
      const { directory } = splitDefaultPath(options.defaultPath)
      const dialogOptions: OpenDialogOptions = {
        Title: options.title,
        Directory: directory,
        Filters: mapFilters(options.filters),
        CanChooseFiles: true
      }
      if (hasProperty(options.properties, 'openDirectory')) {
        dialogOptions.CanChooseDirectories = true
      }
      if (hasProperty(options.properties, 'multiSelections')) {
        dialogOptions.AllowsMultipleSelection = true
      }
      if (hasProperty(options.properties, 'showHiddenFiles')) {
        dialogOptions.ShowHiddenFiles = true
      }
      if (hasProperty(options.properties, 'createDirectory')) {
        dialogOptions.CanCreateDirectories = true
      }
      const result = await Dialogs.OpenFile(dialogOptions)
      if (!result) return []
      return Array.isArray(result) ? result : [result]
    }
  },

  kv: {
    getItem: async <T>(key: string): Promise<T | null> => {
      const value = await KVService.GetItem(key)
      return (value ?? null) as T | null
    },
    setItem: async <T>(key: string, value: T): Promise<void> => {
      await KVService.SetItem(key, value)
    },
    removeItem: async (key: string): Promise<void> => {
      await KVService.RemoveItem(key)
    }
  }
}
