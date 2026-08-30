const electron = require('electron');
const { app, BrowserWindow, ipcMain, shell } = electron;
const path = require('path');
const fs = require('fs');
const { setupUpdater, stopUpdater } = require('./updater');

const isDev = !app.isPackaged;

// Круглит число до 2 знаков (для цен и сумм)
const round2 = (n) => Math.round(parseFloat(n) * 100) / 100;

let CONFIG_PATH, SALES_PATH, PRINTER_CONFIG_PATH, PIN_PATH, PIN_ROOT_PATH, EMAIL_CONFIG_PATH;

function initPaths() {
  CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
  SALES_PATH = path.join(app.getPath('userData'), 'sales.json');
  PRINTER_CONFIG_PATH = path.join(app.getPath('userData'), 'printer.json');
  EMAIL_CONFIG_PATH = path.join(app.getPath('userData'), 'email.json');

  // PIN хранится в userData: папку рядом с exe установщик при обновлении
  // перезаписывает, и файл оттуда может исчезнуть.
  PIN_PATH = path.join(app.getPath('userData'), 'pin.txt');

  // Файл рядом с exe остаётся способом задать PIN вручную, не заходя
  // в программу: если он есть, он и считается настоящим PIN-кодом.
  const rootDir = isDev ? __dirname : path.dirname(app.getPath('exe'));
  PIN_ROOT_PATH = path.join(rootDir, 'pin.txt');
}

// ---------- PIN админки ----------

// Читает 4-значный PIN из файла; null, если файла нет или он испорчен
function readPinFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8').trim();
      // Валидный PIN — ровно 4 цифры
      if (/^\d{4}$/.test(raw)) return raw;
    }
  } catch (error) {
    console.error('Ошибка чтения PIN:', error);
  }
  return null;
}

/**
 * PIN из файла рядом с exe имеет приоритет: это способ сбросить забытый
 * код, положив рядом с программой pin.txt. Основное же хранилище —
 * userData, потому что оно переживает обновление.
 */
function loadPin() {
  const fromRoot = readPinFile(PIN_ROOT_PATH);
  if (fromRoot) {
    // Подхватываем PIN, заданный вручную (и заодно переносим сюда PIN
    // из старых версий, где userData ещё не использовался)
    if (readPinFile(PIN_PATH) !== fromRoot) {
      try { writeFileAtomic(PIN_PATH, fromRoot); } catch (error) {
        console.error('Не удалось перенести PIN в userData:', error);
      }
    }
    return fromRoot;
  }
  return readPinFile(PIN_PATH);
}

function savePin(pin) {
  if (!/^\d{4}$/.test(String(pin))) {
    return { ok: false, error: 'PIN должен состоять из 4 цифр' };
  }
  try {
    writeFileAtomic(PIN_PATH, String(pin));
    // Файл рядом с exe удаляем: иначе он бы навсегда перебивал
    // новый код, заданный из программы
    try {
      if (fs.existsSync(PIN_ROOT_PATH)) fs.unlinkSync(PIN_ROOT_PATH);
    } catch (error) {
      console.error('Не удалось удалить pin.txt рядом с программой:', error);
    }
    return { ok: true };
  } catch (error) {
    console.error('Ошибка сохранения PIN:', error);
    return { ok: false, error: error.message || 'Не удалось сохранить PIN' };
  }
}

// ---------- Безопасная запись файлов данных ----------

// Синхронная пауза без busy-loop — нужна для повтора переименования
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Атомарная запись: пишем во временный файл, сбрасываем на диск,
 * затем переименовываем поверх целевого.
 *
 * Прямой writeFileSync в целевой файл опасен: при потере питания посреди
 * записи на диске остаётся обрезанный файл, то есть теряется вся история,
 * а не последняя запись. Переименование в пределах тома атомарно, поэтому
 * на диске всегда лежит либо старая целая версия, либо новая целая.
 */
function writeFileAtomic(filePath, content) {
  const tmp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.tmp`);

  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, content, 'utf8');
    // Без fsync данные могут остаться в кеше ОС, и переименование
    // зафиксирует пустой файл
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  // На Windows антивирус или индексатор могут на мгновение держать файл
  // открытым — тогда rename падает с EPERM. Повторяем несколько раз.
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.renameSync(tmp, filePath);
      return;
    } catch (error) {
      lastError = error;
      sleepSync(40);
    }
  }

  try { fs.unlinkSync(tmp); } catch (e) { /* уже нет */ }
  throw lastError;
}

/**
 * Файл не разобрался как JSON — значит повреждён.
 * Молча вернуть пустые данные нельзя: следующая запись перезапишет файл
 * и остатки исчезнут окончательно. Отставляем повреждённый файл в сторону,
 * чтобы его можно было восстановить вручную.
 */
function quarantineFile(filePath, error, what) {
  console.error(`Файл ${what} повреждён:`, error && error.message);
  try {
    if (!fs.existsSync(filePath)) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const broken = `${filePath}.corrupt-${stamp}`;
    fs.renameSync(filePath, broken);
    console.error(`Повреждённый файл сохранён как ${broken}`);
  } catch (e) {
    console.error('Не удалось отставить повреждённый файл:', e.message);
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (error) {
    quarantineFile(CONFIG_PATH, error, 'конфига');
  }
  return { products: [], categories: [] };
}

function saveConfig(config) {
  try { writeFileAtomic(CONFIG_PATH, JSON.stringify(config, null, 2)); }
  catch (error) { console.error('Ошибка сохранения конфига:', error); }
}

function loadSales() {
  try {
    if (fs.existsSync(SALES_PATH)) {
      const data = JSON.parse(fs.readFileSync(SALES_PATH, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch (error) {
    quarantineFile(SALES_PATH, error, 'продаж');
  }
  return [];
}

function saveSales(sales) {
  try {
    writeFileAtomic(SALES_PATH, JSON.stringify(sales, null, 2));
    return true;
  } catch (error) {
    console.error('Ошибка сохранения продаж:', error);
    return false;
  }
}

function loadPrinterConfig() {
  try {
    if (fs.existsSync(PRINTER_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(PRINTER_CONFIG_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('Ошибка загрузки настроек принтера:', error);
  }
  return {
    enabled: false,
    printerName: '',
    ip: '192.168.1.100',
    type: 'epson',
    interface: 'auto',
    port: '9100',
    width: 48,
    characterSet: 'PC866_CYRILLIC2'
  };
}

function savePrinterConfig(config) {
  try { writeFileAtomic(PRINTER_CONFIG_PATH, JSON.stringify(config, null, 2)); }
  catch (error) { console.error('Ошибка сохранения настроек принтера:', error); }
}

function calculateStats(sales) {
  const byCategory = {};
  const byDay = {};
  const byPaymentMethod = {};

  sales.forEach(sale => {
    sale.items.forEach(item => {
      const cats = Array.isArray(item.categories) ? item.categories : [];
      const catName = cats.length > 0 ? cats.join(' / ') : 'Без категории';
      if (!byCategory[catName]) byCategory[catName] = { count: 0, revenue: 0 };
      byCategory[catName].count += item.quantity;
      byCategory[catName].revenue += item.price * item.quantity;
    });

    const dayKey = new Date(sale.timestamp).toLocaleDateString('ru-RU');
    if (!byDay[dayKey]) byDay[dayKey] = { count: 0, revenue: 0 };
    byDay[dayKey].count += 1;
    byDay[dayKey].revenue += sale.total;

    if (!byPaymentMethod[sale.paymentMethod]) byPaymentMethod[sale.paymentMethod] = { count: 0, revenue: 0 };
    byPaymentMethod[sale.paymentMethod].count += 1;
    byPaymentMethod[sale.paymentMethod].revenue += sale.total;
  });

  return {
    totalSales: sales.length,
    totalRevenue: sales.reduce((s, x) => s + x.total, 0),
    byCategory, byDay, byPaymentMethod
  };
}

// ---------- Принтер ----------

// В node-thermal-printer v4 сам класс лежит в поле .printer,
// а модуль — обычный объект. Поэтому `new Printer(...)` падал
// с "Printer is not a constructor".
const { printer: ThermalPrinter, types: PrinterTypes } = require('node-thermal-printer');

const os = require('os');
const { execFile, spawn } = require('child_process');
const readline = require('readline');

// C#-обёртка над winspool.drv: отправляет сырые ESC/POS байты в спулер Windows.
// Так работает любой принтер, установленный в Windows (USB в том числе) —
// без нативных npm-модулей и node-gyp.
const RAW_PRINT_CSHARP = `using System;
using System.Runtime.InteropServices;
public class PosRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static void SendBytes(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
      throw new Exception("OpenPrinter:" + Marshal.GetLastWin32Error());
    try {
      DOCINFOW di = new DOCINFOW();
      di.pDocName = "POS Receipt";
      di.pDataType = "RAW";
      if (!StartDocPrinter(hPrinter, 1, di))
        throw new Exception("StartDocPrinter:" + Marshal.GetLastWin32Error());
      try {
        if (!StartPagePrinter(hPrinter))
          throw new Exception("StartPagePrinter:" + Marshal.GetLastWin32Error());
        IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
        try {
          Marshal.Copy(bytes, 0, p, bytes.Length);
          int written;
          if (!WritePrinter(hPrinter, p, bytes.Length, out written))
            throw new Exception("WritePrinter:" + Marshal.GetLastWin32Error());
        } finally { Marshal.FreeCoTaskMem(p); }
        EndPagePrinter(hPrinter);
      } finally { EndDocPrinter(hPrinter); }
    } finally { ClosePrinter(hPrinter); }
  }
}`;

// Рабочий скрипт: компилирует C# ОДИН раз при старте, затем в цикле читает
// задания из stdin. Раньше на каждую печать запускался новый powershell.exe
// с Add-Type, и компиляция C# + запуск процесса + проверка антивирусом
// давали задержку до 10–15 секунд на слабом планшете.
const PRINT_WORKER_PS1 = `$ErrorActionPreference = 'Stop'
# UTF-8 на входе и выходе: иначе кириллица в именах принтеров ломается
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
${RAW_PRINT_CSHARP}
'@
[Console]::Out.WriteLine('{"ready":true}')
[Console]::Out.Flush()
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if ($line.Trim() -eq '') { continue }
  try {
    $req = $line | ConvertFrom-Json
    if ($req.ping) {
      [Console]::Out.WriteLine('{"ok":true}')
    } else {
      $bytes = [System.IO.File]::ReadAllBytes($req.file)
      [PosRawPrinter]::SendBytes($req.printer, $bytes)
      [Console]::Out.WriteLine('{"ok":true}')
    }
  } catch {
    $msg = ($_.Exception.Message -replace '[\\r\\n]+', ' ')
    [Console]::Out.WriteLine((@{ ok = $false; error = $msg } | ConvertTo-Json -Compress))
  }
  [Console]::Out.Flush()
}
`;

let workerScriptPath = null;

// Коды Windows приходят из C# в виде "OpenPrinter:1801" — переводим их
// в понятный текст здесь, чтобы в C# не было нерусских литералов
// (при компиляции через Add-Type кириллица в исходнике теряется)
const WIN32_PRINT_ERRORS = {
  2: 'принтер не найден',
  5: 'нет прав на печать — запустите программу от администратора',
  6: 'неверный дескриптор принтера',
  1722: 'служба «Диспетчер печати» не запущена',
  1801: 'неверное имя принтера',
  1802: 'принтер уже удалён',
  1803: 'неизвестный тип данных для печати',
  3003: 'драйвер принтера не установлен'
};

function describePrintError(raw) {
  const text = String(raw || '').trim();
  const m = text.match(/(OpenPrinter|StartDocPrinter|StartPagePrinter|WritePrinter):(\d+)/);
  if (!m) return text || 'Ошибка печати';

  const code = parseInt(m[2], 10);
  const known = WIN32_PRINT_ERRORS[code];
  const stage = m[1] === 'OpenPrinter' ? 'Подключение к принтеру' : 'Отправка на принтер';
  return known
    ? `${stage}: ${known} (код ${code})`
    : `${stage}: ошибка Windows ${code}`;
}

function getWorkerScriptPath() {
  if (!workerScriptPath) {
    workerScriptPath = path.join(os.tmpdir(), 'pos-print-worker.ps1');
    // BOM — чтобы PowerShell прочитал кириллицу в сообщениях об ошибках
    fs.writeFileSync(workerScriptPath, '﻿' + PRINT_WORKER_PS1, 'utf8');
  }
  return workerScriptPath;
}

// ---- Постоянный процесс печати ----

let printWorker = null;      // ChildProcess
let workerStarting = null;   // Promise готовности
const printQueue = [];       // отложенные задания
let activeJob = null;        // задание, отправленное в PowerShell

function failAllJobs(message) {
  const err = new Error(message);
  if (activeJob) {
    clearTimeout(activeJob.timer);
    activeJob.reject(err);
    activeJob = null;
  }
  while (printQueue.length) {
    printQueue.shift().reject(err);
  }
}

function startPrintWorker() {
  if (workerStarting) return workerStarting;

  workerStarting = new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', getWorkerScriptPath()
      ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      workerStarting = null;
      reject(error);
      return;
    }

    // Если инициализация затянулась — считаем, что рабочий процесс не поднялся
    const initTimer = setTimeout(() => {
      reject(new Error('Процесс печати не ответил при запуске'));
      try { child.kill(); } catch (e) { /* уже мёртв */ }
    }, 30000);

    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      const text = line.trim();
      if (!text) return;

      let msg;
      try {
        msg = JSON.parse(text);
      } catch (e) {
        // Не JSON — диагностический вывод PowerShell, игнорируем
        return;
      }

      if (msg.ready) {
        clearTimeout(initTimer);
        printWorker = child;
        resolve(child);
        pumpPrintQueue();
        return;
      }

      if (activeJob) {
        clearTimeout(activeJob.timer);
        const job = activeJob;
        activeJob = null;
        if (msg.ok) job.resolve();
        else job.reject(new Error(describePrintError(msg.error)));
        pumpPrintQueue();
      }
    });

    let stderrBuf = '';
    child.stderr.on('data', (chunk) => {
      stderrBuf += String(chunk);
      // Сохраняем только последнее — на случай падения при компиляции
      if (stderrBuf.length > 4000) stderrBuf = stderrBuf.slice(-4000);
      console.error('[печать]', String(chunk).trim());
    });

    child.on('error', (error) => {
      clearTimeout(initTimer);
      printWorker = null;
      workerStarting = null;
      failAllJobs(error.message || 'Процесс печати недоступен');
      reject(error);
    });

    child.on('exit', (code) => {
      clearTimeout(initTimer);
      printWorker = null;
      workerStarting = null;
      const detail = stderrBuf.trim().split('\n').pop() || `код ${code}`;
      failAllJobs(`Процесс печати завершился: ${detail}`);
    });
  });

  return workerStarting;
}

function stopPrintWorker() {
  if (printWorker) {
    try { printWorker.stdin.end(); } catch (e) { /* уже закрыт */ }
    try { printWorker.kill(); } catch (e) { /* уже мёртв */ }
    printWorker = null;
  }
  workerStarting = null;
}

function pumpPrintQueue() {
  if (activeJob || printQueue.length === 0 || !printWorker) return;

  const job = printQueue.shift();
  activeJob = job;
  job.timer = setTimeout(() => {
    if (activeJob === job) {
      activeJob = null;
      job.reject(new Error('Принтер не ответил (таймаут 30 с)'));
      // Процесс мог зависнуть на winspool — перезапускаем
      stopPrintWorker();
    }
  }, 30000);

  try {
    printWorker.stdin.write(JSON.stringify({ printer: job.printer, file: job.file }) + '\n');
  } catch (error) {
    clearTimeout(job.timer);
    activeJob = null;
    job.reject(error);
  }
}

function enqueuePrintJob(printerName, dataFile) {
  return new Promise((resolve, reject) => {
    printQueue.push({ printer: printerName, file: dataFile, resolve, reject, timer: null });
    if (printWorker) {
      pumpPrintQueue();
    } else {
      startPrintWorker().catch(error => {
        failAllJobs(error.message || 'Не удалось запустить процесс печати');
      });
    }
  });
}

// Прогрев: поднимаем процесс и компилируем C# заранее, чтобы первый чек
// не ждал компиляцию
function warmUpPrinter() {
  if (process.platform !== 'win32') return;
  startPrintWorker().catch(error => {
    console.error('Прогрев печати не удался:', error.message);
  });
}

function runPowerShell(args, timeout = 20000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args],
      { timeout, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          const msg = (stderr || stdout || error.message || '').trim();
          reject(new Error(msg.split('\n')[0] || 'Ошибка PowerShell'));
        } else {
          resolve(String(stdout || '').trim());
        }
      }
    );
  });
}

// Список принтеров, установленных в Windows — для выпадающего списка в настройках.
// Пробуем три способа по очереди: на разных сборках Windows работает разный
// (модуль PrintManagement может отсутствовать, WMI — быть сломан).
async function listWindowsPrinters() {
  if (process.platform !== 'win32') return [];
  const script = [
    '$names = @()',
    'try { $names = @(Get-Printer -ErrorAction Stop | Select-Object -ExpandProperty Name) } catch {}',
    'if ($names.Count -eq 0) { try { Add-Type -AssemblyName System.Drawing -ErrorAction Stop; $names = @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters) } catch {} }',
    'if ($names.Count -eq 0) { try { $names = @(Get-CimInstance Win32_Printer -ErrorAction Stop | Select-Object -ExpandProperty Name) } catch {} }',
    '$names | ForEach-Object { $_ }'
  ].join('; ');

  try {
    const out = await runPowerShell(['-Command', script]);
    return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  } catch (error) {
    console.error('Не удалось получить список принтеров:', error.message);
    return [];
  }
}

// Отправка сырого буфера на принтер Windows по его имени.
// Уходит в постоянный процесс печати — без запуска powershell.exe на каждый чек.
let receiptCounter = 0;

async function sendRawToWindowsPrinter(printerName, buffer) {
  if (!printerName) throw new Error('Не указано имя принтера');
  // Уникальное имя: иначе параллельные задания перезапишут файл друг другу
  receiptCounter += 1;
  const dataFile = path.join(os.tmpdir(), `pos-receipt-${process.pid}-${receiptCounter}.bin`);
  fs.writeFileSync(dataFile, buffer);
  try {
    await enqueuePrintJob(printerName, dataFile);
  } finally {
    try { fs.unlinkSync(dataFile); } catch (e) { /* не критично */ }
  }
}

// Создаёт экземпляр принтера. Для tcp — сетевой интерфейс библиотеки,
// для остального интерфейс не задаём: буфер отправим сами.
function createPrinter(printerConfig) {
  const cfg = {
    type: printerConfig.type || PrinterTypes.EPSON,
    width: parseInt(printerConfig.width) || 48,
    characterSet: printerConfig.characterSet || 'PC866_CYRILLIC2',
    removeSpecialCharacters: false,
    lineCharacter: '-'
  };

  if (printerConfig.interface === 'tcp') {
    const ip = printerConfig.ip || printerConfig.printerName || '';
    const port = printerConfig.port || '9100';
    cfg.interface = `tcp://${ip}:${port}`;
  } else if (printerConfig.interface === 'serial') {
    // COM-порт/устройство — библиотека пишет в него как в файл
    cfg.interface = printerConfig.port || 'COM1';
  }
  // auto / usb — интерфейс не задаём, печатаем через спулер Windows

  return new ThermalPrinter(cfg);
}

// Отправляет накопленный буфер туда, куда указывает конфиг
async function flushPrinter(printer, printerConfig) {
  const iface = printerConfig.interface || 'auto';
  if (iface === 'tcp' || iface === 'serial') {
    await printer.execute();
  } else {
    await sendRawToWindowsPrinter(printerConfig.printerName, printer.getBuffer());
  }
}

function formatPaymentMethod(method) {
  switch (method) {
    case 'cash': return 'Наличные';
    case 'card': return 'Карта';
    case 'separately': return 'Сдельно';
    default: return String(method || '');
  }
}

/**
 * Подпись размера позиции: «400 мл» у напитков, «150 г» у десертов.
 * Незаданный или нулевой размер подписи не имеет — такая позиция
 * выводится одним названием (штучный товар).
 */
function itemSizeLabel(item) {
  const g = parseFloat(item && item.g);
  if (g > 0) return `${g} г`;
  const ml = parseFloat(item && item.ml);
  if (ml > 0) return `${ml} мл`;
  return '';
}

// Чек для кухни: только номер заказа и что готовить. Никаких цен, итогов,
// оплаты и сдачи — они кухне не нужны, а лишние строки замедляют чтение.
async function printReceipt(printerConfig, items, orderNumber, date) {
  if (!printerConfig || !printerConfig.enabled) {
    return { ok: false, error: 'Принтер отключён' };
  }

  try {
    const printer = createPrinter(printerConfig);
    const when = date || new Date();
    const lines = Array.isArray(items) ? items : [];

    // Шапка
    printer.alignCenter();
    printer.bold(true);
    printer.println('ЗАКАЗ');

    // Номер крупно: кухня должна видеть его с расстояния,
    // не вглядываясь в чек. 3,3 — четырёхкратный размер.
    if (orderNumber) {
      printer.setTextSize(3, 3);
      printer.println(`№${orderNumber}`);
      printer.setTextNormal();
    }

    printer.bold(false);
    printer.println(when.toLocaleString('ru-RU'));
    printer.drawLine();

    // Позиции: каждая единица — отдельной строкой.
    // Две одинаковые порции печатаются двумя строками, а не «x2»,
    // чтобы на кухне их было видно как два отдельных напитка.
    printer.alignLeft();
    printer.bold(true);
    printer.setTextSize(1, 1);

    let totalUnits = 0;
    lines.forEach(item => {
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const size = itemSizeLabel(item);
      const name = item.name || 'Товар';
      const label = size ? `${name} ${size}` : name;
      for (let i = 0; i < qty; i++) {
        printer.println(label);
        totalUnits += 1;
      }
    });

    printer.setTextNormal();
    printer.bold(false);
    printer.drawLine();
    printer.alignCenter();
    printer.println(`Всего порций: ${totalUnits}`);
    printer.cut();

    await flushPrinter(printer, printerConfig);
    console.log(`Чек для кухни напечатан, заказ №${orderNumber || '?'}`);
    return { ok: true };
  } catch (error) {
    console.error('Ошибка печати:', error);
    return { ok: false, error: error.message || 'Ошибка печати' };
  }
}

// ---------- Окно ----------

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#f5f5f5',
    // Полноэкранный режим задаём при создании окна, а не вызовом
    // setFullScreen() после show(): на Windows переход в fullscreen
    // асинхронный, и вызов сразу после show() иногда теряется —
    // отсюда панель задач, которая то пропадает, то нет.
    fullscreen: true,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });

  // Показываем окно только когда содержимое отрисовано — иначе белая вспышка
  win.once('ready-to-show', () => win.show());

  const indexPath = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'public/index.html')}`;

  win.loadURL(indexPath);
}

app.whenReady().then(() => {
  initPaths();
  createWindow();
  setupUpdater();

  // Прогреваем процесс печати заранее, чтобы первый чек не ждал
  // компиляцию C# — но только если печать вообще включена
  if (loadPrinterConfig().enabled) warmUpPrinter();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Не оставляем висеть powershell.exe после закрытия программы
app.on('before-quit', () => {
  stopPrintWorker();
  stopUpdater();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---------- Отчёты в таблицы ----------

// BOM: без него Excel читает файл как ANSI и кириллица превращается в мусор
const CSV_BOM = '﻿';

// Экранирование по RFC 4180 — название товара может содержать ; " или перевод строки
function csvCell(value) {
  const text = String(value ?? '');
  return /[";\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

// Десятичная запятая: русский Excel иначе не распознает число
function csvNum(n) {
  return String(Math.round((parseFloat(n) || 0) * 100) / 100).replace('.', ',');
}

function buildCsv(header, rows) {
  const lines = [header, ...rows].map(cells => cells.map(csvCell).join(';'));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

function paymentLabel(method) {
  return formatPaymentMethod(method);
}

function filterSalesByDate(sales, dateFrom, dateTo) {
  let result = sales;
  if (dateFrom) {
    const from = new Date(dateFrom + 'T00:00:00').getTime();
    result = result.filter(s => s.timestamp >= from);
  }
  if (dateTo) {
    const to = new Date(dateTo + 'T23:59:59.999').getTime();
    result = result.filter(s => s.timestamp <= to);
  }
  return result.slice().sort((a, b) => a.timestamp - b.timestamp);
}

// Собирает набор таблиц по периоду. Возвращает [{ name, content }]
function buildReports(dateFrom, dateTo) {
  const sales = filterSalesByDate(loadSales(), dateFrom, dateTo);

  const periodText = dateFrom || dateTo
    ? `${dateFrom ? new Date(dateFrom).toLocaleDateString('ru-RU') : 'начало'} — ${dateTo ? new Date(dateTo).toLocaleDateString('ru-RU') : 'сегодня'}`
    : 'за всё время';

  const revenue = round2(sales.reduce((s, x) => s + (x.total || 0), 0));
  const avg = sales.length ? round2(revenue / sales.length) : 0;

  // --- Сводка ---
  const byMethod = {};
  sales.forEach(s => {
    const key = s.paymentMethod || 'unknown';
    if (!byMethod[key]) byMethod[key] = { count: 0, revenue: 0 };
    byMethod[key].count += 1;
    byMethod[key].revenue += s.total || 0;
  });

  const summaryRows = [
    ['Период', periodText],
    ['Чеков', sales.length],
    ['Выручка', csvNum(revenue)],
    ['Средний чек', csvNum(avg)],
    [],
    ['Способ оплаты', 'Чеков', 'Выручка']
  ];
  Object.keys(byMethod).forEach(key => {
    summaryRows.push([paymentLabel(key), byMethod[key].count, csvNum(byMethod[key].revenue)]);
  });

  // --- По дням ---
  const byDay = new Map();
  sales.forEach(s => {
    const d = new Date(s.timestamp);
    // Ключ ISO для сортировки, отображение — в русском формате
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!byDay.has(key)) byDay.set(key, { count: 0, revenue: 0 });
    const rec = byDay.get(key);
    rec.count += 1;
    rec.revenue += s.total || 0;
  });
  const dayRows = [...byDay.keys()].sort().map(key => {
    const rec = byDay.get(key);
    return [
      new Date(key).toLocaleDateString('ru-RU'),
      rec.count,
      csvNum(rec.revenue),
      csvNum(rec.count ? rec.revenue / rec.count : 0)
    ];
  });

  // --- По товарам ---
  // Один товар в разных размерах — разные строки отчёта: 400 мл и 250 мл
  // продаются по разной цене, смешивать их в одну строку нельзя
  const byProduct = new Map();
  sales.forEach(s => {
    (s.items || []).forEach(item => {
      const cats = Array.isArray(item.categories) ? item.categories : [];
      const size = itemSizeLabel(item);
      const key = `${item.name}|${size}|${cats.join(' / ')}`;
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          name: item.name,
          volume: size,
          category: cats.join(' / ') || 'Без категории',
          qty: 0,
          revenue: 0
        });
      }
      const rec = byProduct.get(key);
      rec.qty += item.quantity || 0;
      rec.revenue += (item.price || 0) * (item.quantity || 0);
    });
  });
  const productRows = [...byProduct.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .map(p => [p.name, p.volume, p.category, p.qty, csvNum(p.revenue)]);

  // --- Чеки построчно ---
  const receiptRows = [];
  sales.forEach((s, idx) => {
    const d = new Date(s.timestamp);
    (s.items || []).forEach(item => {
      receiptRows.push([
        // Настоящий номер заказа; у продаж до его появления — порядковый
        s.orderNumber || idx + 1,
        d.toLocaleDateString('ru-RU'),
        d.toLocaleTimeString('ru-RU'),
        item.name,
        itemSizeLabel(item),
        (Array.isArray(item.categories) ? item.categories : []).join(' / ') || 'Без категории',
        item.quantity,
        csvNum(item.price),
        csvNum((item.price || 0) * (item.quantity || 0)),
        paymentLabel(s.paymentMethod),
        csvNum(s.total)
      ]);
    });
  });

  return {
    salesCount: sales.length,
    revenue,
    periodText,
    files: [
      { name: 'svodka.csv', content: buildCsv(['Показатель', 'Значение', ''], summaryRows) },
      { name: 'po-dnyam.csv', content: buildCsv(['Дата', 'Чеков', 'Выручка', 'Средний чек'], dayRows) },
      { name: 'po-tovaram.csv', content: buildCsv(['Товар', 'Размер', 'Категория', 'Продано', 'Выручка'], productRows) },
      { name: 'cheki.csv', content: buildCsv(['№ чека', 'Дата', 'Время', 'Товар', 'Размер', 'Категория', 'Кол-во', 'Цена', 'Сумма', 'Оплата', 'Итог чека'], receiptRows) }
    ]
  };
}

function periodSuffix(dateFrom, dateTo) {
  return `${dateFrom || 'начало'}_${dateTo || 'сегодня'}`;
}

function exportReportsToDisk(dateFrom, dateTo) {
  try {
    const report = buildReports(dateFrom, dateTo);
    const dir = path.join(app.getPath('userData'), 'exports', `otchet-${periodSuffix(dateFrom, dateTo)}`);
    fs.mkdirSync(dir, { recursive: true });
    report.files.forEach(f => fs.writeFileSync(path.join(dir, f.name), f.content, 'utf8'));
    return {
      ok: true,
      dir,
      files: report.files.map(f => f.name),
      salesCount: report.salesCount,
      revenue: report.revenue
    };
  } catch (error) {
    console.error('Ошибка экспорта:', error);
    return { ok: false, error: error.message || 'Ошибка экспорта' };
  }
}

// ---------- Настройки почты ----------

function loadEmailConfig() {
  try {
    if (fs.existsSync(EMAIL_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(EMAIL_CONFIG_PATH, 'utf8'));
    }
  } catch (error) {
    console.error('Ошибка загрузки настроек почты:', error);
  }
  return { host: '', port: 587, secure: false, user: '', pass: '', from: '', to: '' };
}

function saveEmailConfig(cfg) {
  try {
    writeFileAtomic(EMAIL_CONFIG_PATH, JSON.stringify(cfg, null, 2));
  } catch (error) {
    console.error('Ошибка сохранения настроек почты:', error);
  }
}

// Понятные сообщения вместо кодов SMTP
function describeMailError(error) {
  const code = error && error.code;
  const text = (error && error.message) || 'Не удалось отправить письмо';
  const known = {
    EAUTH: 'сервер не принял логин или пароль',
    ECONNECTION: 'не удалось подключиться к серверу — проверьте адрес и порт',
    ETIMEDOUT: 'сервер не ответил — проверьте интернет и порт',
    EDNS: 'адрес сервера не найден',
    ESOCKET: 'сбой соединения — возможно, неверно выбрано шифрование'
  }[code];
  return known ? `${known} (${code})` : text;
}

async function sendReportsByEmail(dateFrom, dateTo) {
  const cfg = loadEmailConfig();

  const missing = [];
  if (!cfg.host) missing.push('адрес сервера');
  if (!cfg.user) missing.push('логин');
  if (!cfg.pass) missing.push('пароль');
  if (!cfg.to) missing.push('получатель');
  if (missing.length) {
    return { ok: false, error: `Заполните настройки почты: ${missing.join(', ')}` };
  }

  try {
    const report = buildReports(dateFrom, dateTo);
    if (report.salesCount === 0) {
      return { ok: false, error: 'За выбранный период нет продаж — отчёт пустой' };
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: parseInt(cfg.port) || 587,
      secure: !!cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass }
    });

    const suffix = periodSuffix(dateFrom, dateTo);
    await transporter.sendMail({
      from: cfg.from || cfg.user,
      to: cfg.to,
      subject: `Отчёт по продажам: ${report.periodText}`,
      text: [
        `Период: ${report.periodText}`,
        `Чеков: ${report.salesCount}`,
        `Выручка: ${csvNum(report.revenue)} Br`,
        '',
        'Таблицы во вложении:',
        '  svodka.csv — сводка по периоду',
        '  po-dnyam.csv — выручка по дням',
        '  po-tovaram.csv — что продавалось',
        '  cheki.csv — все чеки построчно'
      ].join('\n'),
      attachments: report.files.map(f => ({
        filename: f.name.replace('.csv', `-${suffix}.csv`),
        content: f.content,
        contentType: 'text/csv; charset=utf-8'
      }))
    });

    return { ok: true, to: cfg.to, salesCount: report.salesCount };
  } catch (error) {
    console.error('Ошибка отправки почты:', error);
    return { ok: false, error: describeMailError(error) };
  }
}

// ---------- Номер заказа ----------

/** Ключ локальной календарной даты: по нему счётчик сбрасывается в полночь */
function localDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Номер заказа выводим из истории продаж, а не из отдельного счётчика:
 * не нужно синхронизировать два файла, сброс в полночь происходит сам,
 * и номер не разъедется с данными после восстановления из бэкапа.
 */
function nextOrderNumber(sales, timestamp) {
  const key = localDateKey(new Date(timestamp));
  const todayCount = sales.reduce(
    (n, s) => (localDateKey(new Date(s.timestamp)) === key ? n + 1 : n),
    0
  );
  return todayCount + 1;
}

// ---------- IPC ----------

ipcMain.on('save-config', (event, config) => saveConfig(config));

ipcMain.on('save-sale', (event, sale) => {
  const sales = loadSales();

  // Номер присваиваем до записи, чтобы он попал и в историю, и в чек
  sale.orderNumber = nextOrderNumber(sales, sale.timestamp);
  sales.push(sale);

  const saved = saveSales(sales);
  if (!saved && !event.sender.isDestroyed()) {
    // Продажа не легла на диск — кассир должен об этом знать
    event.sender.send('save-error', 'Продажа не сохранена на диск');
  }

  const stats = calculateStats(sales);
  event.sender.send('stats-updated', { sales, ...stats });

  // Номер заказа нужен на экране: кассиру его называть клиенту,
  // на бумаге он уезжает на кухню
  event.sender.send('order-number', sale.orderNumber);

  // Автоматическая печать чека при оплате.
  // Результат обязательно отправляем в интерфейс — иначе ошибка печати
  // остаётся незамеченной, и кассир думает, что чек вышел.
  const printerConfig = loadPrinterConfig();
  if (printerConfig.enabled) {
    const printConfig = { ...printerConfig, amountReceived: sale.amountReceived };
    printReceipt(printConfig, sale.items, sale.orderNumber)
      .then(result => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('print-result', result);
        }
      })
      .catch(error => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('print-result', {
            ok: false,
            error: error.message || 'Ошибка печати'
          });
        }
      });
  }
});

// Повторная печать чека (например, если бумага закончилась)
ipcMain.handle('print-receipt', async (event, { items, orderNumber }) => {
  try {
    return await printReceipt(loadPrinterConfig(), items, orderNumber);
  } catch (error) {
    return { ok: false, error: error.message || 'Ошибка печати' };
  }
});

ipcMain.handle('test-printer', async () => {
  const printerConfig = loadPrinterConfig();
  try {
    const printer = createPrinter(printerConfig);

    printer.alignCenter();
    printer.bold(true);
    printer.setTextSize(1, 1);
    printer.println('ТЕСТ ПЕЧАТИ');
    printer.setTextNormal();
    printer.bold(false);
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Тип: ${printerConfig.type || 'epson'}`);
    printer.println(`Подключение: ${printerConfig.interface || 'auto'}`);
    if (printerConfig.interface === 'tcp') {
      printer.println(`Адрес: ${printerConfig.ip}:${printerConfig.port}`);
    } else if (printerConfig.interface === 'serial') {
      printer.println(`Порт: ${printerConfig.port}`);
    } else {
      printer.println(`Принтер: ${printerConfig.printerName}`);
    }

    printer.drawLine();
    printer.alignCenter();
    printer.println('Русский текст: АБВГДЕ абвгде');
    printer.println('Цена: 12,50 Br');
    printer.println('Принтер работает!');
    printer.cut();

    await flushPrinter(printer, printerConfig);
    return { ok: true };
  } catch (error) {
    console.error('Ошибка тестовой печати:', error);
    return { ok: false, error: error.message || 'Ошибка принтера' };
  }
});

// Список принтеров Windows для выпадающего списка в настройках
ipcMain.handle('list-printers', async () => {
  return listWindowsPrinters();
});

ipcMain.on('get-stats', (event) => {
  const sales = loadSales();
  event.reply('stats-updated', { sales, ...calculateStats(sales) });
});

// Стартовые данные запрашивает сам renderer.
// Раньше main рассылал их по did-finish-load, но слушатель в React
// регистрируется в useEffect — то есть позже. Кто успел первым, то и
// получалось: примерно в половине запусков конфиг терялся.
ipcMain.handle('get-initial-data', async () => {
  const sales = loadSales();
  return {
    config: loadConfig(),
    // StatsPanel читает stats.sales, поэтому массив продаж обязателен:
    // calculateStats() его не возвращает
    stats: { sales, ...calculateStats(sales) },
    printerConfig: loadPrinterConfig()
  };
});

ipcMain.on('exit-app', (event) => app.quit());

ipcMain.on('save-printer-config', (event, config) => {
  savePrinterConfig(config);
  // Только что включили печать — поднимаем процесс заранее
  if (config && config.enabled) warmUpPrinter();
});

ipcMain.on('get-printer-config', (event) => {
  event.reply('printer-config-loaded', loadPrinterConfig());
});

// ---------- PIN админки ----------

// Есть ли уже установленный PIN
ipcMain.handle('pin-exists', async () => {
  return { exists: loadPin() !== null, path: PIN_PATH };
});

// Установить PIN (только если его ещё нет)
ipcMain.handle('set-pin', async (event, pin) => {
  if (loadPin() !== null) {
    return { ok: false, error: 'PIN уже установлен' };
  }
  return savePin(pin);
});

// Сменить PIN — нужен текущий
ipcMain.handle('change-pin', async (event, { oldPin, newPin }) => {
  const current = loadPin();
  if (current === null) return savePin(newPin);
  if (String(oldPin) !== current) {
    return { ok: false, error: 'Неверный текущий PIN' };
  }
  return savePin(newPin);
});

// Проверить PIN
ipcMain.handle('verify-pin', async (event, pin) => {
  const current = loadPin();
  if (current === null) return { ok: false, error: 'PIN не установлен' };
  return { ok: String(pin) === current };
});

// ---------- Резервное копирование ----------

ipcMain.handle('backup', async () => {
  try {
    const backup = {
      version: 1,
      date: new Date().toISOString(),
      config: loadConfig(),
      sales: loadSales(),
      printerConfig: loadPrinterConfig()
    };
    const data = JSON.stringify(backup, null, 2);
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const fileName = `pos-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(backupDir, fileName);
    fs.writeFileSync(filePath, data);
    return { ok: true, filePath, fileName, size: Buffer.byteLength(data) };
  } catch (error) {
    return { ok: false, error: error.message || 'Ошибка резервного копирования' };
  }
});

ipcMain.handle('list-backups', async () => {
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) return [];
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort().reverse();
    return files.map(f => {
      const stat = fs.statSync(path.join(backupDir, f));
      return { name: f, date: stat.mtime, size: stat.size };
    });
  } catch (error) {
    return [];
  }
});

ipcMain.handle('restore', async (event, fileName) => {
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    const filePath = path.join(backupDir, fileName);
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: 'Файл не найден' };
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.config) saveConfig(data.config);
    if (data.sales) saveSales(data.sales);
    if (data.printerConfig) savePrinterConfig(data.printerConfig);
    return { ok: true, fileName };
  } catch (error) {
    return { ok: false, error: error.message || 'Ошибка восстановления' };
  }
});

ipcMain.handle('delete-backup', async (event, fileName) => {
  try {
    const backupDir = path.join(app.getPath('userData'), 'backups');
    const filePath = path.join(backupDir, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || 'Ошибка удаления' };
  }
});

ipcMain.handle('export-sales-csv', async (event, { dateFrom, dateTo }) => {
  return exportReportsToDisk(dateFrom, dateTo);
});

// Экспорт отчётов в файлы
ipcMain.handle('export-reports', async (event, { dateFrom, dateTo } = {}) => {
  return exportReportsToDisk(dateFrom, dateTo);
});

// Открыть папку с выгруженными отчётами в проводнике
ipcMain.handle('open-folder', async (event, dirPath) => {
  try {
    await shell.openPath(dirPath);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || 'Не удалось открыть папку' };
  }
});

// Отправка отчётов на почту
ipcMain.handle('send-reports-email', async (event, { dateFrom, dateTo } = {}) => {
  return sendReportsByEmail(dateFrom, dateTo);
});

// Предпросмотр: сколько данных попадёт в отчёт за выбранный период
ipcMain.handle('preview-reports', async (event, { dateFrom, dateTo } = {}) => {
  try {
    const sales = filterSalesByDate(loadSales(), dateFrom, dateTo);
    return {
      ok: true,
      salesCount: sales.length,
      revenue: round2(sales.reduce((s, x) => s + (x.total || 0), 0))
    };
  } catch (error) {
    return { ok: false, error: error.message || 'Ошибка' };
  }
});

// Настройки почты. Пароль наружу не отдаём — только признак, что он задан
ipcMain.handle('get-email-config', async () => {
  const cfg = loadEmailConfig();
  return { ...cfg, pass: '', hasPass: !!cfg.pass };
});

ipcMain.handle('save-email-config', async (event, cfg) => {
  try {
    const current = loadEmailConfig();
    // Пустой пароль означает «не менять» — иначе сохранение других полей стёрло бы его
    const pass = cfg.pass ? cfg.pass : current.pass;
    saveEmailConfig({
      host: (cfg.host || '').trim(),
      port: parseInt(cfg.port) || 587,
      secure: !!cfg.secure,
      user: (cfg.user || '').trim(),
      pass,
      from: (cfg.from || '').trim(),
      to: (cfg.to || '').trim()
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || 'Не удалось сохранить' };
  }
});
