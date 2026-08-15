import type { I18nKey } from './zh'

export const en: Record<I18nKey, string> = {
  // common
  'common.confirm': 'Confirm',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.loading': 'Loading…',
  'common.retry': 'Retry',

  // nav
  'nav.settings': 'Settings',
  'nav.profiles': 'Profiles',

  // dsh missing banner
  'banner.title': 'DeepSeek Harness (dsh) not found',
  'banner.desc':
    'dsh is the command-line tool of DeepSeek Harness. Plugin install, remove and the web server all depend on it. Install it first:',
  'banner.installBun': 'Install via bun',
  'banner.installNpm': 'Install via npm',
  'banner.or': 'or',
  'banner.manual': 'Or point to the dsh executable manually:',
  'banner.placeholder': 'Path to the dsh executable, e.g. /Users/you/.bun/bin/dsh',
  'banner.chooseFile': 'Browse…',
  'banner.verify': 'Verify & save',
  'banner.refresh': 'Re-check after install',
  'banner.install': 'Install',
  'banner.toolMissing': 'bun / npm not found. Copy the command to your terminal, or point to the dsh executable manually',
  'banner.officialSite': 'Visit the DeepSeek Harness website',
  'banner.verified': 'dsh v{version} recognized',
  'banner.invalid': 'Invalid path or not an executable dsh: {error}',
  'banner.missing': 'dsh not found; features are limited',

  // server
  'server.title': 'dsh web server',
  'server.runningOwn': 'Running (started here)',
  'server.runningForeign': 'Running (started externally)',
  'server.stopped': 'Stopped',
  'server.unknown': 'Unknown',
  'server.port': 'Port',
  'server.start': 'Start',
  'server.stop': 'Stop',
  'server.open': 'Open in browser',
  'server.busy': 'Working…',
  'server.log': 'Runtime log',
  'server.noDsh': 'dsh not ready, configure it above first',

  // list
  'list.official': 'Official plugins',
  'list.thirdParty': 'Third-party plugins',
  'list.empty': 'No plugins in this profile yet. Click "Install plugin" to search and add.',
  'list.searchPlaceholder': 'Search plugins by name or description…',
  'list.noMatch': 'No matching plugins',
  'list.refresh': 'Refresh list',
  'list.refreshDone': 'Profile list refreshed',
  'list.refreshFailed': 'Failed to refresh profile list',

  // toolbar
  'toolbar.install': 'Install plugin',
  'toolbar.globalSettings': 'Global Settings',
  'toolbar.pure': 'Pure mode',
  'toolbar.pureOn': 'Pure mode on: only @deepseek-ai/ official plugins remain',
  'toolbar.pureOff': 'Pure mode off: all third-party plugins restored',

  // plugin card
  'plugin.config': 'Configure',
  'plugin.remove': 'Uninstall',
  'plugin.openHomepage': 'Open homepage',
  'plugin.update': 'Update',
  'plugin.source.npm': 'npm',
  'plugin.source.github': 'GitHub',
  'plugin.source.local': 'local',
  'plugin.source.unknown': 'unknown source',
  'plugin.removeConfirm':
    'Uninstall plugin {name}? It will be dropped from dependencies and bundles; you can reinstall it anytime.',
  'plugin.removing': 'Uninstalling {name}…',
  'plugin.removed': 'Uninstalled {name}',
  'plugin.removeFailed': 'Uninstall failed: {error}',
  'plugin.disabledTip': 'Disabled (cordis.patch.yml)',
  'plugin.enabledTip': 'Enabled',

  // update
  'update.title': 'Update plugin',
  'update.update': 'Update',
  'update.cancelUpdate': 'Cancel update',
  'update.consolePlaceholder': 'Update output will show here',
  'update.spawnFailed': 'Failed to start dsh — configure the dsh path in settings first',
  'update.killed': 'Update cancelled',
  'update.failed': 'Update failed (exit code {code})',
  'update.restartAsk':
    'Plugin updated. It takes effect after restarting the dsh web server. Restart now?',

  // restart prompt
  'restart.title': 'Restart web server',
  'restart.actionEnabled': 'Enabled',
  'restart.actionDisabled': 'Disabled',
  'restart.actionRemoved': 'Uninstalled',
  'restart.actionPureOn': 'Pure mode on',
  'restart.actionPureOff': 'Pure mode off',
  'restart.confirm':
    '{action} plugin {name}. The change takes effect after restarting the dsh web server. Restart now?',
  'restart.confirmPure':
    '{action}. The change takes effect after restarting the dsh web server. Restart now?',
  'restart.now': 'Restart now',
  'restart.later': 'Later',
  'restart.foreign': 'The server was started externally, please restart dsh web manually',
  'restart.deferred': 'The change will take effect next time the web server starts',
  'restart.restarting': 'Restarting web server…',
  'restart.done': 'Web server restarted',

  // install
  'install.title': 'Install plugin',
  'install.placeholder': 'Package name / pkg@version / github:user/repo#branch',
  'install.install': 'Install',
  'install.cancel': 'Cancel',
  'install.cancelInstall': 'Cancel install',
  'install.consolePlaceholder': 'Install output will show here',
  'install.spawnFailed': 'Failed to start dsh — configure the dsh path in settings first',
  'install.killed': 'Install cancelled',
  'install.failed': 'Install failed (exit code {code})',
  'install.restartAsk':
    'Plugin installed. It takes effect after restarting the dsh web server. Restart now?',

  // install dsh (setup page)
  'installDsh.title': 'Install dsh',
  'installDsh.consolePlaceholder': 'Installing — output appears here…',
  'installDsh.cancel': 'Cancel install',
  'installDsh.close': 'Close',
  'installDsh.done': 'Install finished',
  'installDsh.killed': 'Install cancelled',
  'installDsh.failed': 'Install failed (exit code {code})',
  'installDsh.spawnFailed': 'Failed to start install process',

  // config modal
  'config.title': 'Plugin config',
  'config.row': 'Target row',
  'config.jsonLabel': 'config JSON',
  'config.invalidJson': 'Invalid JSON: {error}',
  'config.saved': 'Config saved to cordis.patch.yml',

  // settings
  'settings.title': 'Settings',
  'settings.yaml.title': 'Edit settings.yaml',
  'settings.yaml.pathLabel': 'Config file path',
  'settings.yaml.invalidYaml': 'Invalid YAML: {error}',
  'settings.yaml.saved': 'settings.yaml saved',
  'settings.dshPath': 'dsh executable',
  'settings.dshPathHint': 'Leave empty to auto-detect (PATH / ~/.bun/bin)',
  'settings.chooseFile': 'Browse…',
  'settings.port': 'Web server port',
  'settings.browserMode': 'Open web page in',
  'settings.browserSystem': 'System browser',
  'settings.browserBuiltin': 'Built-in browser',
  'settings.builtinSize': 'Built-in window size',
  'settings.theme': 'Theme',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.themeSystem': 'System',
  'settings.language': 'Language',
  'settings.confirmRestart': 'Ask to restart after plugin changes',
  'settings.confirmRestartHint':
    'After enabling / disabling / uninstalling a plugin or toggling pure mode, ask whether to restart the web server if it is running',

  // app updater
  'updater.readyTitle': 'App update',
  'updater.readyDesc': 'A new version is ready. Restart the app to apply it?',
  'updater.restart': 'Restart now',
  'updater.later': 'Later',
  'updater.upToDate': 'You are up to date',
  'updater.checkFailed': 'Update check failed: {error}'
}
