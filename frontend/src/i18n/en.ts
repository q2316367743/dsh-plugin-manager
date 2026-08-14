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
  'banner.title': 'dsh command not found',
  'banner.desc':
    'dsh is the command-line entry of DeepSeek Harness. Plugin install, remove and the web server all depend on it. Install it first:',
  'banner.installBun': 'Install via bun',
  'banner.installNpm': 'Install via npm',
  'banner.or': 'or',
  'banner.manual': 'Or point to the dsh executable manually:',
  'banner.placeholder': 'Path to the dsh executable, e.g. /Users/you/.bun/bin/dsh',
  'banner.chooseFile': 'Browse…',
  'banner.verify': 'Verify & save',
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

  // toolbar
  'toolbar.install': 'Install plugin',
  'toolbar.pure': 'Pure mode',
  'toolbar.pureOn': 'Pure mode on: only @deepseek-ai/ official plugins remain',
  'toolbar.pureOff': 'Pure mode off: all third-party plugins restored',
  'toolbar.checkUpdates': 'Check updates',
  'toolbar.checking': 'Checking…',
  'toolbar.noUpdates': 'All plugins up to date',
  'toolbar.updatesFound': '{count} update(s) available',

  // plugin card
  'plugin.config': 'Configure',
  'plugin.remove': 'Uninstall',
  'plugin.openHomepage': 'Open homepage',
  'plugin.update': 'Update',
  'plugin.updateTo': 'Update to {version}',
  'plugin.hasUpdate': 'Update available',
  'plugin.source.npm': 'npm',
  'plugin.source.github': 'GitHub',
  'plugin.source.local': 'local',
  'plugin.source.unknown': 'unknown source',
  'plugin.removeConfirm':
    'Uninstall plugin {name}? It will be dropped from dependencies and bundles; you can reinstall it anytime.',
  'plugin.removing': 'Uninstalling {name}…',
  'plugin.removed': 'Uninstalled {name}',
  'plugin.removeFailed': 'Uninstall failed: {error}',
  'plugin.updating': 'Updating {name}…',
  'plugin.updated': 'Updated {name}',
  'plugin.updateFailed': 'Update failed: {error}',
  'plugin.disabledTip': 'Disabled (cordis.patch.yml)',
  'plugin.enabledTip': 'Enabled',

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

  // config modal
  'config.title': 'Plugin config',
  'config.row': 'Target row',
  'config.jsonLabel': 'config JSON',
  'config.invalidJson': 'Invalid JSON: {error}',
  'config.saved': 'Config saved to cordis.patch.yml',

  // settings
  'settings.title': 'Settings',
  'settings.dshPath': 'dsh executable',
  'settings.dshPathHint': 'Leave empty to auto-detect (PATH / ~/.bun/bin)',
  'settings.chooseFile': 'Browse…',
  'settings.port': 'Web server port',
  'settings.theme': 'Theme',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.themeSystem': 'System',
  'settings.language': 'Language',
  'settings.confirmRestart': 'Ask to restart after plugin changes',
  'settings.confirmRestartHint':
    'After enabling / disabling / uninstalling a plugin or toggling pure mode, ask whether to restart the web server if it is running'
}
