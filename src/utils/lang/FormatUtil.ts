import dayjs from 'dayjs'

export const KB = 1024.0
export const MB = 1024 * KB
export const GB = 1024 * MB

/**
 * 美化数据单位
 *
 * @param {number} value 需要美化的值
 */
export function prettyDataUnit(value: number) {
  if (value > GB) {
    let temp = value / GB
    return temp.toFixed(2) + 'GB'
  }
  if (value > MB) {
    let temp = value / MB
    return temp.toFixed(2) + 'MB'
  }
  if (value > KB) {
    let temp = value / KB
    return temp.toFixed(2) + 'KB'
  }
  return value + 'B'
}

export function prettyDate(date?: number | string | Date) {
  const now = new Date().getTime()
  const old = date ? new Date(date).getTime() : new Date().getTime()
  const diffValue = now - old
  let result: string
  const minute = 1000 * 60
  const hour = minute * 60
  const day = hour * 24
  const month = day * 30
  const year = month * 12

  const _year = diffValue / year
  const _month = diffValue / month
  const _week = diffValue / (7 * day)
  const _day = diffValue / day
  const _hour = diffValue / hour
  const _min = diffValue / minute

  if (_year >= 1) result = _year.toFixed(0) + '年前'
  else if (_month >= 1) result = _month.toFixed(0) + '个月前'
  else if (_week >= 1) result = _week.toFixed(0) + '周前'
  else if (_day >= 1) result = _day.toFixed(0) + '天前'
  else if (_hour >= 1) result = _hour.toFixed(0) + '个小时前'
  else if (_min >= 1) result = _min.toFixed(0) + '分钟前'
  else result = '刚刚'
  return result
}

function padStartNumber(num: number, maxLength: number, fillString?: string): string {
  return `${num}`.padStart(maxLength, fillString)
}

export function prettyDateTime(date: number, showZero = false) {
  if (!date || date <= 0) {
    return showZero ? '00:00' : '--:--'
  }
  let minute = Math.floor(date / 60)
  let second = Math.floor(date % 60)
  return `${padStartNumber(minute, 2, '0')}:${padStartNumber(second, 2, '0')}`
}

export function toDateString(
  date: number | string | Date | null | undefined,
  format = 'YYYY-MM-DD HH:mm:ss'
) {
  return dayjs(date).format(format)
}


/**
 * 美化持续时间
 * @param ms 持续毫秒数
 */
export function prettyDurationTime(ms: number) {
  const SECOND = 1000
  const MINUTE = 60 * SECOND
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR
  const MONTH = 30 * DAY
  const YEAR = 365 * DAY

  if (ms < SECOND) return '1 秒'

  if (ms < MINUTE) {
    const s = Math.floor(ms / SECOND)
    return `${s} 秒`
  }

  if (ms < HOUR) {
    const m = Math.floor(ms / MINUTE)
    const s = Math.floor((ms % MINUTE) / SECOND)
    return `${m} 分钟 ${s} 秒`
  }

  if (ms < DAY) {
    const h = Math.floor(ms / HOUR)
    const m = Math.floor((ms % HOUR) / MINUTE)
    return `${h} 小时 ${m} 分钟`
  }

  if (ms < MONTH) {
    const d = Math.floor(ms / DAY)
    const h = Math.floor((ms % DAY) / HOUR)
    return h > 0 ? `${d} 天 ${h} 小时` : `${d} 天`
  }

  if (ms < YEAR) {
    const M = Math.floor(ms / MONTH)
    const d = Math.floor((ms % MONTH) / DAY)
    return d > 0 ? `${M} 月 ${d} 天` : `${M} 月`
  }

  const y = Math.floor(ms / YEAR)
  const M = Math.floor((ms % YEAR) / MONTH)
  return M > 0 ? `${y} 年 ${M} 月` : `${y} 年`
}

