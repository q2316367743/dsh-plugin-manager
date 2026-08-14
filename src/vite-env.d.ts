/// <reference types="vite/client" />
/// <reference path="./types/inject.d.ts" />

import type { ProfileManifest, InstalledPackage, SpawnHandlers } from '@/types/dsh'

declare global {
  interface RouteMeta {
    hidden?: boolean
    icon: JSX.Element
  }

  interface Window {
    preload: {
      net: {
        /**
         * 从url下载一个文件到指定目录
         * @param url 链接
         * @param path 要保存的文件路径，包含文件名
         */
        downloadFileFromUrl(url: string, path: string): Promise<void>
        /**
         * 将路径转换为href
         * @param path 路径
         */
        pathToHref(path: string): string
        /**
         * HTTP 请求并解析 JSON（GET/POST、跟随重定向、超时）
         */
        httpJson(
          url: string,
          options?: {
            method?: string
            headers?: Record<string, string>
            body?: unknown
            timeout?: number
            redirects?: number
          }
        ): Promise<unknown>
      }
      inject: InjectApi
      dsh: {
        getDshHome(): string
        listProfiles(): string[]
        readProfileManifest(profile: string): ProfileManifest | null
        writeProfileManifest(profile: string, manifest: ProfileManifest): void
        readProfilePatch(profile: string): string
        writeProfilePatch(profile: string, content: string): void
        readBundlePatch(profile: string, packageName: string): string | null
        readInstalledPackage(profile: string, packageName: string): InstalledPackage | null
        resolveBundleDir(profile: string, packageName: string): string | null
      resolveDshBin(configuredPath?: string): string | null
      /**
       * 解析并探测 dsh：路径解析（手动 > PATH > ~/.bun/bin）+
       * 运行方式探测（直接执行；失败则 bun 兜底解释执行）
       */
      resolveDsh(configuredPath?: string): {
        state: 'ok' | 'missing' | 'invalid'
        path?: string
        command?: string
        prefix?: string[]
        version?: string
        error?: string
      }
      getLogFile(profile: string): string
      }
      proc: {
        spawnStream(
          cmd: string,
          args: string[],
          options?: { cwd?: string; env?: Record<string, string | undefined>; detached?: boolean },
          handlers?: SpawnHandlers
        ): { pid: number | undefined }
        kill(pid: number): Promise<boolean>
        isAlive(pid: number): boolean
        checkPort(port: number, host?: string): Promise<boolean>
        findPidByPort(port: number): number | null
      }
      file: {
        exists(path: string): boolean
        readTextFile(path: string): string
        writeTextFile(path: string, content: string): void
      }
    }
  }
}

export {}
