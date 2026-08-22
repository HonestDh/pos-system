import React, { useState, useEffect } from 'react';

const PRINTER_TYPES = [
  { id: 'epson', label: 'Epson / ESC-POS (обычный выбор)' },
  { id: 'star', label: 'Star' },
  { id: 'tanca', label: 'Tanca' },
  { id: 'daruma', label: 'Daruma' },
  { id: 'brother', label: 'Brother' }
];

const PrinterSettings = ({ config, onSave }) => {
  const [enabled, setEnabled] = useState(config.enabled || false);
  const [printerName, setPrinterName] = useState(config.printerName || '');
  const [type, setType] = useState(config.type || 'epson');
  const [interfaceType, setInterfaceType] = useState(config.interface || 'auto');
  const [port, setPort] = useState(config.port || '9100');
  const [ip, setIp] = useState(config.ip || '192.168.1.100');
  const [width, setWidth] = useState(config.width || 48);

  const [printers, setPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(true);
  const [manualName, setManualName] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saved, setSaved] = useState(false);

  // Подтягиваем список принтеров, установленных в Windows
  useEffect(() => {
    if (!window.electron) {
      setLoadingPrinters(false);
      return;
    }
    window.electron.ipcRenderer.invoke('list-printers').then(list => {
      setPrinters(list || []);
      setLoadingPrinters(false);
      // Если список пуст и имя не задано — переключаемся на ручной ввод
      if ((!list || list.length === 0) && !printerName) setManualName(true);
    });
  }, []);

  // Уже сохранённый принтер всегда должен быть в списке опций, даже если
  // перечисление его не вернуло — иначе <select> сбрасывается на заглушку
  const printerOptions = printerName && !printers.includes(printerName)
    ? [printerName, ...printers]
    : printers;

  const buildConfig = () => ({
    enabled,
    printerName,
    type,
    interface: interfaceType,
    port,
    ip,
    width: parseInt(width) || 48,
    characterSet: 'PC866_CYRILLIC2'
  });

  const handleSave = () => {
    onSave(buildConfig());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Тест печатает по СОХРАНЁННОМУ конфигу, поэтому сначала сохраняем —
  // иначе тест уйдёт на старые настройки
  const handleTestPrint = () => {
    if (!window.electron) return;
    onSave(buildConfig());
    setIsTesting(true);
    setTestResult(null);
    // Небольшая пауза, чтобы main-процесс успел записать printer.json
    setTimeout(() => {
      window.electron.ipcRenderer.invoke('test-printer').then(result => {
        setIsTesting(false);
        setTestResult(result);
      });
    }, 250);
  };

  const inputCls = 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base';

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-5">Настройки принтера</h1>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="mb-5">
            <label className="flex items-center gap-4 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-lg font-bold text-gray-900">Печать чеков при оплате</span>
            </label>
          </div>

          <div className={`space-y-4 ${enabled ? 'opacity-100' : 'opacity-50'}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Подключение</label>
              <select
                value={interfaceType}
                onChange={(e) => setInterfaceType(e.target.value)}
                className={inputCls}
                disabled={!enabled}
              >
                <option value="auto">USB / принтер Windows</option>
                <option value="tcp">Ethernet (по IP-адресу)</option>
                <option value="serial">COM-порт</option>
              </select>
            </div>

            {/* USB / Windows: выбираем принтер из списка установленных */}
            {(interfaceType === 'auto' || interfaceType === 'usb') && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Принтер</label>
                  {printerOptions.length > 0 && (
                    <button
                      onClick={() => setManualName(!manualName)}
                      disabled={!enabled}
                      className="text-sm text-blue-600 font-semibold px-2 py-1"
                    >
                      {manualName ? 'Выбрать из списка' : 'Ввести вручную'}
                    </button>
                  )}
                </div>

                {manualName ? (
                  <input
                    type="text"
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    placeholder="Имя принтера точно как в Windows"
                    className={inputCls}
                    disabled={!enabled}
                  />
                ) : (
                  <select
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    className={inputCls}
                    disabled={!enabled}
                  >
                    <option value="">
                      {loadingPrinters ? 'Поиск принтеров...' : '— выберите принтер —'}
                    </option>
                    {printerOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                )}

                {!loadingPrinters && printerOptions.length === 0 && (
                  <p className="text-sm text-amber-600 mt-2">
                    Список принтеров получить не удалось — введите имя вручную,
                    точно как в «Устройства и принтеры».
                  </p>
                )}
              </div>
            )}

            {interfaceType === 'tcp' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">IP-адрес</label>
                  <input
                    type="text"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="192.168.1.100"
                    className={inputCls}
                    disabled={!enabled}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Порт</label>
                  <input
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder="9100"
                    className={inputCls}
                    disabled={!enabled}
                  />
                </div>
              </div>
            )}

            {interfaceType === 'serial' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">COM-порт</label>
                <input
                  type="text"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="COM1"
                  className={inputCls}
                  disabled={!enabled}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Тип (протокол)</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={inputCls}
                  disabled={!enabled}
                >
                  {PRINTER_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ширина (символов)</label>
                <select
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  className={inputCls}
                  disabled={!enabled}
                >
                  <option value={48}>48 — лента 80 мм</option>
                  <option value={32}>32 — лента 58 мм</option>
                  <option value={42}>42 — лента 80 мм (мелкий шрифт)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleSave}
              disabled={!enabled}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-colors min-h-[52px] active:scale-[0.98] ${
                enabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400'
              }`}
            >
              {saved ? '✓ Сохранено' : '💾 Сохранить настройки'}
            </button>

            <button
              onClick={handleTestPrint}
              disabled={!enabled || isTesting}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-colors min-h-[52px] active:scale-[0.98] ${
                enabled && !isTesting ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'
              }`}
            >
              {isTesting ? '⏳ Печатаю...' : '🖨️ Тестовая печать'}
            </button>

            {testResult && (
              <div className={`p-4 rounded-xl text-center font-bold ${
                testResult.ok
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {testResult.ok ? '✓ Тест напечатан' : `✕ ${testResult.error}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrinterSettings;
