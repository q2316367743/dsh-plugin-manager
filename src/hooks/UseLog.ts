
interface UseLogOptions {
  name: string
}

export const useLog = (options: UseLogOptions) => {
  return {
    debug: (...data: any[]) => {
      console.debug(`[${options.name}] `, ...data)
    },
    info: (...data: any[]) => {
      console.log(`[${options.name}] `, ...data)
    },
    warn: (...data: any[]) => {
      console.warn(`[${options.name}] `, ...data)
    },
    error: (...data: any[]) => {
      console.error(`[${options.name}] `, ...data)
    }
  }
}
