// Обновление программы через релизы на GitHub.
//
// Своего сервера нет: electron-builder при сборке публикует установщик
// и latest.yml в релиз репозитория, а программа читает latest.yml оттуда.
// GitHub раздаёт файлы публичных репозиториев бесплатно, так что
// он и работает сервером обновлений.

const { app, ipcMain, BrowserWindow } = require('electron');

const isDev = !app.isPackaged;

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
