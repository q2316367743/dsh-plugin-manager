/**
 * cordis.patch.yml 解析 / 修改 / 序列化。
 * 使用 yaml 库的 Document 节点级操作，保证注释与 `!!js` 表达式往返保真。
 */
import { Document, parseDocument, stringify } from 'yaml'
import type { YAMLMap, YAMLSeq } from 'yaml'
import type { BundleRowRef, PatchEntry } from '@/types/dsh'

/** 解析 profile 级 patch 文本为条目数组（无法解析时返回空数组） */
export function parsePatchEntries(text: string): PatchEntry[] {
  if (!text?.trim()) return []
  const doc = parseDocument(text)
  if (doc.errors.length || !doc.contents) return []
  const entries = (doc.toJS() ?? []) as PatchEntry[]
  return Array.isArray(entries) ? entries : []
}

/** 从 bundle 自带 patch 文本中收集 insert 的行 id（用于启停定位） */
export function collectInsertRows(text: string | null | undefined): BundleRowRef[] {
  if (!text?.trim()) return []
  const doc = parseDocument(text)
  if (doc.errors.length || !doc.contents) return []
  const items = ((doc.contents as YAMLSeq)?.items ?? []) as YAMLMap[]
  const rows: BundleRowRef[] = []
  for (const item of items) {
    const insert = item?.get?.('insert') as YAMLSeq | undefined
    const rowsNode = insert?.items as YAMLMap[] | undefined
    if (!rowsNode) continue
    for (const row of rowsNode) {
      const id = row?.get?.('id')
      if (typeof id === 'string') {
        const name = row.get('name')
        rows.push({ id, name: typeof name === 'string' ? name : undefined })
      }
    }
  }
  return rows
}

/** 空文本时构造一个带 schema 的空文档，保证 contents 是 YAMLSeq 且强制 block 风格 */
function ensureSeq(doc: Document): YAMLSeq {
  if (!doc.contents) doc.contents = doc.createNode([])
  const seq = doc.contents as YAMLSeq
  seq.flow = false
  return seq
}

/** 按行 id 切换 disabled 状态（不存在的行自动追加） */
export function togglePatchEntry(text: string, id: string, disabled: boolean): string {
  return setRowsDisabled(text, [id], disabled)
}

/**
 * 批量设置多行的 disabled 状态。
 * 启用时只删除 disabled 键（保留 config 等其它覆盖，避免误删用户配置）；
 * 行已无任何内容时整体移除，避免残留空行。
 */
export function setRowsDisabled(text: string, ids: string[], disabled: boolean): string {
  const doc = parseDocument(text || '')
  const seq = ensureSeq(doc)
  for (const id of ids) {
    const target = seq.items.find((item) => (item as YAMLMap)?.get?.('id') === id) as
      | YAMLMap
      | undefined
    if (target) {
      if (disabled) {
        target.set('disabled', true)
      } else {
        target.delete('disabled')
        // 仅剩 id 键的条目是管理端添加的空覆盖（无 disabled / config），整体移除
        if (target.items.length <= 1) {
          seq.items.splice(seq.items.indexOf(target), 1)
        }
      }
    } else if (disabled) {
      seq.add(doc.createNode({ id, disabled: true }))
    }
  }
  return stringify(doc)
}

/** 读取某行的 config 覆盖（无则 undefined） */
export function readPatchConfig(text: string, id: string): Record<string, unknown> | undefined {
  const entry = parsePatchEntries(text).find((e) => e.id === id)
  return entry?.config
}

/** 写入某行的 config 覆盖（无该行则新建） */
export function setPatchConfigEntry(
  text: string,
  id: string,
  config: Record<string, unknown>
): string {
  const doc = parseDocument(text || '')
  const seq = ensureSeq(doc)
  let target = seq.items.find((item) => (item as YAMLMap)?.get?.('id') === id) as
    | YAMLMap
    | undefined
  if (!target) {
    target = doc.createNode({ id }) as YAMLMap
    seq.add(target)
  }
  target.set('config', doc.createNode(config))
  return stringify(doc)
}

/** 按行 id 删除条目；目标不存在时返回原文，避免把空文件重写为 `[]` */
export function removePatchEntry(text: string, id: string): string {
  const doc = parseDocument(text || '')
  const seq = ensureSeq(doc)
  const index = seq.items.findIndex((item) => (item as YAMLMap)?.get?.('id') === id)
  if (index < 0) return text
  seq.items.splice(index, 1)
  return stringify(doc)
}
