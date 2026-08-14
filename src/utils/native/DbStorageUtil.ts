// --------------------------------------- 基础对象 ---------------------------------------

import { cloneDeep } from 'es-toolkit'
import { toRaw } from 'vue'

export interface DbList<T> {
  list: Array<T>

  rev?: string
}

export interface DbRecord<T> {
  id: string

  record: T

  rev?: string
}

// --------------------------------------- 列表操作 ---------------------------------------

/**
 * 异步获取一个对象，并且对象需要时数组
 *
 * 如果一个存储是是个数组，可以使用此方法
 * @param key 键
 */
export async function listByAsync<T = any>(key: string): Promise<DbList<T>> {
  const res = await window.preload.inject.db.promises.get(key)
  if (res) {
    return {
      list: res.value || new Array<T>(),
      rev: res._rev
    }
  }
  return { list: [] }
}

/**
 * 异步保存一个数组到一个存储中
 * @param key 键
 * @param records 数组
 * @param rev 恢复值
 * @param retryCount 重试次数
 */
export async function saveListByAsync<T>(
  key: string,
  records: Array<T>,
  rev?: string,
  retryCount = 3
): Promise<undefined | string> {
  try {
    const res = await window.preload.inject.db.promises.put({
      _id: key,
      _rev: rev,
      value: toRaw(records)
    })
    if (res.error) {
      if (res.message === 'Document update conflict') {
        if (retryCount <= 0) return Promise.reject('saveListByAsync: max retries exceeded (conflict)')
        const res = await window.preload.inject.db.promises.get(key)
        return await saveListByAsync(key, records, res ? res._rev : undefined, retryCount - 1)
      } else if (res.message === 'An object could not be cloned.') {
        if (retryCount <= 0) return Promise.reject('saveListByAsync: max retries exceeded (clone)')
        return await saveListByAsync(key, cloneDeep(records), rev, retryCount - 1)
      } else if (
        res.message ===
        "DataCloneError: Failed to execute 'put' on 'IDBObjectStore': [object Array] could not be cloned."
      ) {
        if (retryCount <= 0) return Promise.reject('saveListByAsync: max retries exceeded (clone)')
        return await saveListByAsync(key, cloneDeep(records), rev, retryCount - 1)
      } else if (
        res.message ===
        "DataCloneError: Failed to execute 'put' on 'IDBObjectStore': #<Object> could not be cloned."
      ) {
        if (retryCount <= 0) return Promise.reject('saveListByAsync: max retries exceeded (clone)')
        return await saveListByAsync(key, cloneDeep(records), rev, retryCount - 1)
      }
      console.error(res)
      return Promise.reject(res.message)
    }
    return res.rev
  } catch (e: any) {
    if (e.message === 'An object could not be cloned.') {
      if (retryCount <= 0) return Promise.reject('saveListByAsync: max retries exceeded (clone)')
      return await saveListByAsync(key, cloneDeep(records), rev, retryCount - 1)
    } else {
      return Promise.reject(e)
    }
  }
}

/**
 * 通过多个键，获取多个值
 * @param key 多个键，如果是数组，则绝对匹配，如果是字符串，则前缀匹配
 */
export async function listRecordByAsync<T>(key?: string | string[]): Promise<Array<DbRecord<T>>> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const items = await window.preload.inject.db.promises.allDocs(key)
  return items
    .filter((e) => !!e)
    .map((item) => ({
      id: item._id,
      record: item.value,
      rev: item._rev
    }))
}

// --------------------------------------- 单一对象操作 ---------------------------------------

/**
 * 获取一个值，如果不存在，则使用默认值
 * @param key 键
 * @param defaultValue 默认值
 */
export async function getFromOneWithDefaultByAsync<T>(
  key: string,
  defaultValue: T
): Promise<DbRecord<T>> {
  const res = await window.preload.inject.db.promises.get(key)
  if (!res) {
    return { record: defaultValue, id: key }
  }
  return Promise.resolve({
    id: key,
    record: Object.assign(defaultValue || {}, res.value),
    rev: res._rev
  })
}

/**
 * 获取一个值，不存在则返回null
 * @param key 键
 */
export async function getFromOneByAsync<T = any>(key: string): Promise<DbRecord<T | null>> {
  const res = await window.preload.inject.db.promises.get(key)
  if (!res) {
    return { record: null, id: key }
  }
  return Promise.resolve({
    id: key,
    record: res.value,
    rev: res._rev
  })
}

/**
 * 保存一条数据
 * @param key 键
 * @param value 值
 * @param rev 恢复
 * @param err 错误处理函数
 */
export async function saveOneByAsync<T>(
  key: string,
  value: T,
  rev?: string,
  retryCount = 3,
  err?: (e: Error) => void
): Promise<undefined | string> {
  try {
    const res = await window.preload.inject.db.promises.put({
      _id: key,
      _rev: rev,
      value: toRaw(value)
    })
    if (res.error) {
      if (res.message === 'Document update conflict') {
        if (retryCount <= 0) return Promise.reject('saveOneByAsync: max retries exceeded (conflict)')
        const res = await window.preload.inject.db.promises.get(key)
        return await saveOneByAsync(key, value, res ? res._rev : undefined, retryCount - 1)
      } else if (
        res.message ===
        "DataCloneError: Failed to execute 'put' on 'IDBObjectStore': #<Object> could not be cloned."
      ) {
        if (retryCount <= 0) return Promise.reject('saveOneByAsync: max retries exceeded (clone)')
        return await saveOneByAsync(key, cloneDeep(value), rev, retryCount - 1)
      }
      console.error(res)
      if (err) {
        err(new Error(res.message))
      } else {
        return Promise.reject(res.message)
      }
    }
    return Promise.resolve(res.rev)
  } catch (e: any) {
    if (e.message === 'An object could not be cloned.') {
      if (retryCount <= 0) return Promise.reject('saveOneByAsync: max retries exceeded (clone)')
      return await saveOneByAsync(key, cloneDeep(value), rev, retryCount - 1)
    } else if (
      e.message ===
      "DataCloneError: Failed to execute 'put' on 'IDBObjectStore': #<Object> could not be cloned."
    ) {
      if (retryCount <= 0) return Promise.reject('saveOneByAsync: max retries exceeded (clone)')
      return await saveOneByAsync(key, cloneDeep(value), rev, retryCount - 1)
    } else {
      console.error(e)
      return Promise.reject(e)
    }
  }
}

/**
 * 删除一条记录
 * @param key 键
 * @param ignoreError 是否忽略异常
 */
export async function removeOneByAsync(key: string, ignoreError: boolean = false): Promise<void> {
  const res = await window.preload.inject.db.promises.remove(key)
  if (res.error) {
    if (!ignoreError) {
      return Promise.reject(res.message)
    }
  }
}

// --------------------------------------- 批量操作 ---------------------------------------

/**
 * 批量删除指定key开头的文档
 * @param key ID前缀
 * @param ignoreError 是否忽略异常，默认不忽略
 */
export async function removeMultiByAsync(key: string, ignoreError: boolean = false): Promise<void> {
  const items = await window.preload.inject.db.promises.allDocs(key)
  for (let item of items) {
    await removeOneByAsync(item._id, ignoreError)
  }
}

// --------------------------------------- 附件 ---------------------------------------

/**
 * 存储附件到新文档
 * @param docId 文档ID
 * @param attachment 附件 buffer
 * @return url
 */
export async function postAttachment(docId: string, attachment: Blob | File): Promise<string> {
  const buffer = await attachment.arrayBuffer()
  const res = await window.preload.inject.db.promises.postAttachment(
    docId,
    new Uint8Array(buffer),
    'application/octet-stream'
  )
  if (res.error) {
    return Promise.reject(res.message)
  }
  return Promise.resolve('attachment:' + docId)
}
