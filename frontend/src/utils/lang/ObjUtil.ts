
export function objectify<T extends Record<string, any>, K extends string, V, KG extends keyof T>(
  arr: Array<T>,
  key: KG | ((val: T) => K),
  value?: (val: T) => V
): Record<K, V> {
  const keyFunc = typeof key === 'function' ? key : (val: T) => val[key] as K
  const valueFunc = value ? value : (val: T) => val as unknown as V
  return arr.reduce(
    (acc, val) => {
      acc[keyFunc(val)] = valueFunc(val)
      return acc
    },
    {} as Record<K, V>
  )
}
