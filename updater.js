// Обновление программы через релизы на GitHub.
//
// Своего сервера нет: electron-builder при сборке публикует установщик
// и latest.yml в релиз репозитория, а программа читает latest.yml оттуда.
// GitHub раздаёт файлы публичных репозиториев бесплатно, так что
// он и работает сервером обновлений.

const { app, ipcMain, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = !app.isPackaged;

// Пути для системы отката
const BACKUPS_DIR = path.join(app.getPath('userData'), 'backups');
const VERSION_HISTORY_PATH = path.join(app.getPath('userData'), 'version-history.json');
const MAX_BACKUPS = 2;

// Первая проверка не сразу при запуске: касса в этот момент открывает
// окно и прогревает принтер, сетевой запрос тут ни к чему
const FIRST_CHECK_DELAY_MS = 20 * 1000;
// Раз в 6 часов — планшет может работать сутками без перезапуска
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let autoUpdater = null;
let recheckTimer = null;

/**
 * Последнее известное состояние. Рендерер спрашивает его при открытии
 * панели обновлений, поэтому состояние живёт здесь, а не только
 * в сообщениях: панель может открыться уже после проверки.
 *
 * state: idle | checking | available | downloading | downloaded | uptodate | error
 */
let status = {
  state: 'idle',
  currentVersion: app.getVersion(),
  version: null,
  notes: null,
  percent: 0,
  error: null,
  // Автопроверка в dev не работает: у незапакованного приложения нет
  // app-update.yml, поэтому просто сообщаем это в интерфейс
  supported: !isDev
};

function setStatus(patch) {
  status = { ...status, ...patch };
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) win.webContents.send('updater-status', status);
  });
}

// Технические сообщения electron-updater по-английски и малопонятны кассиру
function describeError(error) {
  const raw = String((error && error.message) || error || '');

  if (/ENOTFOUND|EAI_AGAIN|ENETUNREACH|getaddrinfo/i.test(raw)) {
    return 'Нет подключения к интернету';
  }
  if (/ETIMEDOUT|ESOCKETTIMEDOUT|timeout/i.test(raw)) {
    return 'Сервер обновлений не ответил. Попробуйте позже';
  }
  if (/404/.test(raw)) {
    return 'Обновления не найдены: релиз ещё не опубликован';
  }
  if (/403|rate limit/i.test(raw)) {
    return 'GitHub временно ограничил запросы. Попробуйте позже';
  }
  if (/ENOSPC/i.test(raw)) {
    return 'Недостаточно места на диске для загрузки обновления';
  }
  if (/sha512|checksum|signature/i.test(raw)) {
    return 'Файл обновления повреждён. Загрузка отменена';
  }
  if (/app-update\.yml/i.test(raw)) {
    return 'Обновления доступны только в установленной версии программы';
  }
  return raw || 'Неизвестная ошибка обновления';
}

// ==================== Система отката версий ====================

/**
 * Читает историю версий из файла. Если файла нет — возвращает базовую структуру.
 */
function readVersionHistory() {
  try {
    if (fs.existsSync(VERSION_HISTORY_PATH)) {
      const raw = fs.readFileSync(VERSION_HISTORY_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error('Ошибка чтения version-history.json:', error);
  }
  return { current: app.getVersion(), previous: null, backups: [] };
}

/**
 * Сохраняет историю версий в файл.
 */
function writeVersionHistory(history) {
  try {
    if (!fs.existsSync(path.dirname(VERSION_HISTORY_PATH))) {
      fs.mkdirSync(path.dirname(VERSION_HISTORY_PATH), { recursive: true });
    }
    fs.writeFileSync(VERSION_HISTORY_PATH, JSON.stringify(history, null, 2), 'utf8');
  } catch (error) {
    console.error('Ошибка записи version-history.json:', error);
  }
}

/**
 * Создаёт backup текущей версии перед обновлением.
 * Копирует .exe в папку backups/ и обновляет метаданные.
 */
async function createBackup() {
  if (isDev) return { ok: false, reason: 'dev' };

  try {
    const exePath = app.getPath('exe');
    const currentVersion = app.getVersion();
    const backupFileName = `app-backup-${currentVersion}.exe`;
    const backupPath = path.join(BACKUPS_DIR, backupFileName);

    console.log('[Backup] Создание backup версии', currentVersion);

    // Создаём папку backups, если её нет
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    // Копируем текущий .exe в backup
    fs.copyFileSync(exePath, backupPath);
    console.log('[Backup] Файл скопирован:', backupPath);

    // Обновляем метаданные
    const history = readVersionHistory();
    history.previous = currentVersion;
    history.backups = history.backups.filter(b => b.version !== currentVersion);
    history.backups.unshift({
      version: currentVersion,
      file: backupFileName,
      date: new Date().toISOString().split('T')[0]
    });

    // Ограничиваем количество backup'ов
    if (history.backups.length > MAX_BACKUPS) {
      const toRemove = history.backups.slice(MAX_BACKUPS);
      toRemove.forEach(b => {
        const oldPath = path.join(BACKUPS_DIR, b.file);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          console.log('[Backup] Удалён старый backup:', b.version);
        }
      });
      history.backups = history.backups.slice(0, MAX_BACKUPS);
    }

    writeVersionHistory(history);
    console.log('[Backup] Метаданные обновлены');
    return { ok: true, backupPath };
  } catch (error) {
    console.error('[Backup] Ошибка создания backup:', error);
    return { ok: false, reason: error.message };
  }
}

/**
 * Откатывает приложение на предыдущую версию.
 * Запускает сохранённый backup установщик и закрывает текущее приложение.
 */
function rollbackToPrevious() {
  if (isDev) return { ok: false, reason: 'Откат доступен только в установленной версии' };

  try {
    const history = readVersionHistory();

    if (!history.previous || history.backups.length === 0) {
      console.log('[Rollback] Нет доступных backup для отката');
      return { ok: false, reason: 'Нет доступных версий для отката' };
    }

    const backup = history.backups[0];
    const backupPath = path.join(BACKUPS_DIR, backup.file);

    console.log('[Rollback] Откат на версию', backup.version);
    console.log('[Rollback] Путь к backup:', backupPath);

    if (!fs.existsSync(backupPath)) {
      console.error('[Rollback] Файл backup не найден');
      return { ok: false, reason: 'Файл backup не найден. Откат невозможен' };
    }

    // Проверка целостности: файл должен быть разумного размера (> 50MB)
    const stats = fs.statSync(backupPath);
    console.log('[Rollback] Размер файла:', Math.round(stats.size / 1024 / 1024), 'MB');

    if (stats.size < 50 * 1024 * 1024) {
      console.error('[Rollback] Файл backup повреждён (слишком маленький)');
      return { ok: false, reason: 'Файл backup повреждён' };
    }

    // Запускаем установщик предыдущей версии с тихой установкой
    const { spawn } = require('child_process');
    console.log('[Rollback] Запуск установщика...');

    spawn(backupPath, ['/S'], {
      detached: true,
      stdio: 'ignore'
    }).unref();

    // Закрываем приложение, чтобы установщик мог обновить файлы
    console.log('[Rollback] Закрытие приложения для установки');
    setImmediate(() => app.quit());

    return { ok: true, version: backup.version };
  } catch (error) {
    console.error('[Rollback] Ошибка отката:', error);
    return { ok: false, reason: error.message };
  }
}

/**
 * Возвращает информацию о доступных backup'ах для UI.
 */
function getBackupInfo() {
  const history = readVersionHistory();
  return {
    current: history.current,
    previous: history.previous,
    hasBackup: history.backups.length > 0 && history.previous !== null
  };
}

// ================================================================

// Из тела релиза GitHub делаем короткий текст: разметка на кассе не нужна
function plainNotes(notes) {
  if (!notes) return null;
  const text = Array.isArray(notes)
    ? notes.map(n => (n && n.note) || '').join('\n')
    : String(notes);

  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`#>]/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join('\n')
    .slice(0, 800) || null;
}

function initAutoUpdater() {
  if (autoUpdater) return autoUpdater;

  ({ autoUpdater } = require('electron-updater'));

  // Скачиваем только по нажатию кассира: загрузка в разгар смены
  // ест канал, а обновление посреди рабочего дня никому не нужно
  autoUpdater.autoDownload = false;
  // Если скачали, но не нажали «Установить» — поставится при выходе
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on('checking-for-update', () => {
    setStatus({ state: 'checking', error: null });
  });

  autoUpdater.on('update-available', (info) => {
    setStatus({
      state: 'available',
      version: info && info.version,
      notes: plainNotes(info && info.releaseNotes),
      percent: 0,
      error: null
    });
  });

  autoUpdater.on('update-not-available', () => {
    setStatus({ state: 'uptodate', version: null, percent: 0, error: null });
  });

  autoUpdater.on('download-progress', (p) => {
    setStatus({ state: 'downloading', percent: Math.round((p && p.percent) || 0) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setStatus({
      state: 'downloaded',
      version: info && info.version,
      percent: 100,
      error: null
    });
  });

  autoUpdater.on('error', (error) => {
    setStatus({ state: 'error', error: describeError(error) });
  });

  return autoUpdater;
}

async function checkForUpdates() {
  if (isDev) {
    setStatus({ state: 'error', error: 'Обновления доступны только в установленной версии' });
    return status;
  }
  // Во время загрузки повторная проверка сбила бы прогресс
  if (status.state === 'downloading') return status;

  try {
    await initAutoUpdater().checkForUpdates();
  } catch (error) {
    setStatus({ state: 'error', error: describeError(error) });
  }
  return status;
}

async function downloadUpdate() {
  if (isDev) return status;
  try {
    // Создаём backup перед загрузкой обновления
    await createBackup();

    setStatus({ state: 'downloading', percent: 0, error: null });
    await initAutoUpdater().downloadUpdate();
  } catch (error) {
    setStatus({ state: 'error', error: describeError(error) });
  }
  return status;
}

/**
 * Ставит обновление и перезапускает программу.
 * Вызывать только когда корзина пуста — иначе незакрытый чек потеряется,
 * поэтому проверку пустоты делает рендерер, у которого есть корзина.
 */
function installUpdate() {
  if (isDev || status.state !== 'downloaded') return { ok: false };

  // Обновляем метаданные перед установкой новой версии
  try {
    const history = readVersionHistory();
    history.current = status.version || app.getVersion();
    writeVersionHistory(history);
  } catch (error) {
    console.error('Ошибка обновления метаданных:', error);
  }

  // isSilent = true: установщик у нас с диалогами (кассир при первой
  // установке выбирает папку), но при обновлении эти диалоги пришлось бы
  // прокликивать на планшете — ставим тихо, в ту же папку.
  // setImmediate: даём ответить на IPC до того, как процесс завершится
  setImmediate(() => autoUpdater.quitAndInstall(true, true));
  return { ok: true };
}

/** Регистрирует IPC и запускает фоновую проверку. Вызывается один раз при старте. */
function setupUpdater() {
  ipcMain.handle('updater-get-status', async () => status);
  ipcMain.handle('updater-check', async () => checkForUpdates());
  ipcMain.handle('updater-download', async () => downloadUpdate());
  ipcMain.handle('updater-install', async () => installUpdate());
  ipcMain.handle('updater-get-backup-info', async () => getBackupInfo());
  ipcMain.handle('updater-rollback', async () => rollbackToPrevious());

  if (isDev) return;

  setTimeout(() => {
    checkForUpdates();
    recheckTimer = setInterval(checkForUpdates, RECHECK_INTERVAL_MS);
  }, FIRST_CHECK_DELAY_MS);
}

function stopUpdater() {
  if (recheckTimer) {
    clearInterval(recheckTimer);
    recheckTimer = null;
  }
}

module.exports = { setupUpdater, stopUpdater };
