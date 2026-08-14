/**
 * HTTP 工具（preload Node 环境）：JSON 请求。
 * 前端经 window.preload.net.httpJson 访问（npm registry / GitHub API）。
 */
const https = require('node:https')
const http = require('node:http')

module.exports = {
  /**
   * HTTP 请求并解析 JSON（GET/POST、跟随重定向、超时）
   * @param url 请求地址
   * @param options {method, headers, body, timeout, redirects}
   * @return {Promise<unknown>}
   */
  httpJson: (url, options = {}) => {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 15000,
      redirects = 5
    } = options

    return new Promise((resolve, reject) => {
      const doRequest = (target, redirectLeft) => {
        let link
        try {
          link = new URL(target)
        } catch (e) {
          reject(new Error(`invalid url: ${target}`))
          return
        }
        const lib = link.protocol.startsWith('https') ? https : http
        const request = lib.request(
          link,
          {
            method,
            headers: {
              'User-Agent': 'dsh-plugin-manager/1.0.0',
              Accept: 'application/json',
              ...headers
            },
            timeout
          },
          (response) => {
            const status = response.statusCode || 0
            const location = response.headers.location
            if (location && [301, 302, 303, 307, 308].includes(status) && redirectLeft > 0) {
              response.resume()
              doRequest(new URL(location, target).toString(), redirectLeft - 1)
              return
            }
            const chunks = []
            response.on('data', (chunk) => chunks.push(chunk))
            response.on('end', () => {
              const text = Buffer.concat(chunks).toString('utf8')
              if (status < 200 || status >= 300) {
                reject(new Error(`HTTP ${status}: ${text.slice(0, 500)}`))
                return
              }
              try {
                resolve(JSON.parse(text))
              } catch {
                reject(new Error(`invalid json response: ${text.slice(0, 200)}`))
              }
            })
          }
        )
        request.on('timeout', () => request.destroy(new Error(`request timeout after ${timeout}ms`)))
        request.on('error', reject)
        if (body) request.write(typeof body === 'string' ? body : JSON.stringify(body))
        request.end()
      }
      doRequest(url, redirects)
    })
  }
}
