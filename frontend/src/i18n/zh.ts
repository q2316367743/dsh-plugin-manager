export const zh = {
  // 通用
  'common.confirm': '确认',
  'common.cancel': '取消',
  'common.save': '保存',
  'common.close': '关闭',
  'common.copy': '复制',
  'common.copied': '已复制',
  'common.loading': '加载中…',
  'common.retry': '重试',

  // 导航
  'nav.settings': '设置',
  'nav.profiles': '平台',

  // dsh 缺失横幅
  'banner.title': '未检测到 dsh 命令',
  'banner.desc': 'dsh 是 DeepSeek Harness 的命令行入口，插件安装、移除与 web 服务启动都依赖它。请先安装：',
  'banner.installBun': '通过 bun 安装',
  'banner.installNpm': '通过 npm 安装',
  'banner.or': '或',
  'banner.manual': '也可手动指定 dsh 可执行文件路径：',
  'banner.placeholder': 'dsh 可执行文件的路径，如 /Users/you/.bun/bin/dsh',
  'banner.chooseFile': '选择文件',
  'banner.verify': '校验并保存',
  'banner.verified': '已识别 dsh v{version}',
  'banner.invalid': '路径无效或不是可执行的 dsh：{error}',
  'banner.missing': '未找到 dsh，功能已受限',

  // 服务控制
  'server.title': 'dsh web 服务',
  'server.runningOwn': '运行中（本管理器启动）',
  'server.runningForeign': '运行中（外部启动）',
  'server.stopped': '未启动',
  'server.unknown': '未知',
  'server.port': '端口',
  'server.start': '启动',
  'server.stop': '停止',
  'server.open': '打开浏览器',
  'server.busy': '处理中…',
  'server.log': '运行日志',
  'server.noDsh': 'dsh 未就绪，请先在上方配置',

  // 插件列表
  'list.official': '官方插件',
  'list.thirdParty': '第三方插件',
  'list.empty': '该平台暂无插件，点击「安装插件」搜索添加',
  'list.searchPlaceholder': '搜索插件名称或描述…',
  'list.noMatch': '没有匹配的插件',

  // 工具栏
  'toolbar.install': '安装插件',
  'toolbar.pure': '纯净模式',
  'toolbar.pureOn': '纯净模式已开启：仅保留 @deepseek-ai/ 官方插件',
  'toolbar.pureOff': '已关闭纯净模式，恢复所有第三方插件',
  'toolbar.checkUpdates': '检查更新',
  'toolbar.checking': '检查中…',
  'toolbar.noUpdates': '所有插件已是最新',
  'toolbar.updatesFound': '发现 {count} 个可更新插件',

  // 插件卡片
  'plugin.config': '配置',
  'plugin.remove': '卸载',
  'plugin.openHomepage': '打开主页',
  'plugin.update': '更新',
  'plugin.updateTo': '更新到 {version}',
  'plugin.hasUpdate': '可更新',
  'plugin.source.npm': 'npm',
  'plugin.source.github': 'GitHub',
  'plugin.source.local': '本地',
  'plugin.source.unknown': '未知来源',
  'plugin.removeConfirm': '确定卸载插件 {name} 吗？将从依赖与 bundles 中移除，可随时重新安装。',
  'plugin.removing': '正在卸载 {name}…',
  'plugin.removed': '已卸载 {name}',
  'plugin.removeFailed': '卸载失败：{error}',
  'plugin.updating': '正在更新 {name}…',
  'plugin.updated': '已更新 {name}',
  'plugin.updateFailed': '更新失败：{error}',
  'plugin.disabledTip': '已禁用（cordis.patch.yml）',
  'plugin.enabledTip': '已启用',

  // 重启提示
  'restart.title': '重启 web 服务',
  'restart.actionEnabled': '启用',
  'restart.actionDisabled': '禁用',
  'restart.actionRemoved': '卸载',
  'restart.actionPureOn': '开启纯净模式',
  'restart.actionPureOff': '关闭纯净模式',
  'restart.confirm': '已{action}插件 {name}，改动需重启 dsh web 服务后生效，是否立即重启？',
  'restart.confirmPure': '已{action}，改动需重启 dsh web 服务后生效，是否立即重启？',
  'restart.now': '立即重启',
  'restart.later': '稍后',
  'restart.foreign': '服务由外部启动，请手动重启 dsh web 以生效',
  'restart.deferred': '改动将在下次启动 web 服务时生效',
  'restart.restarting': '正在重启 web 服务…',
  'restart.done': 'web 服务已重启',

  // 安装
  'install.title': '安装插件',
  'install.placeholder': '插件名 / pkg@版本 / github:user/repo#分支',
  'install.install': '安装',
  'install.cancel': '取消',
  'install.cancelInstall': '取消安装',
  'install.consolePlaceholder': '安装输出将显示在这里',
  'install.spawnFailed': '无法启动 dsh，请先在设置中配置 dsh 路径',
  'install.killed': '已取消安装',
  'install.failed': '安装失败（退出码 {code}）',
  'install.restartAsk': '插件已安装，重启 dsh web 服务后生效，是否立即重启？',

  // 配置弹窗
  'config.title': '插件配置',
  'config.row': '目标行',
  'config.jsonLabel': 'config JSON',
  'config.invalidJson': 'JSON 格式错误：{error}',
  'config.saved': '配置已保存到 cordis.patch.yml',

  // 设置
  'settings.title': '设置',
  'settings.dshPath': 'dsh 可执行文件',
  'settings.dshPathHint': '留空则自动检测（PATH / ~/.bun/bin）',
  'settings.chooseFile': '选择文件',
  'settings.port': 'web 服务端口',
  'settings.theme': '主题',
  'settings.themeLight': '亮色',
  'settings.themeDark': '暗色',
  'settings.themeSystem': '跟随系统',
  'settings.language': '语言',
  'settings.confirmRestart': '插件变更后询问是否重启服务',
  'settings.confirmRestartHint': '启用 / 禁用 / 卸载插件或切换纯净模式后，若 web 服务在运行则询问是否立即重启'
}

export type I18nKey = keyof typeof zh
