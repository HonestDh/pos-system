import React, { useState, useEffect } from 'react';
import { fmtPrice } from '../utils/format';

// Локальная дата в формате YYYY-MM-DD (toISOString дал бы UTC и сдвинул день)
const toLocalDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const shiftDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
};

const ExportPanel = () => {
  const today = toLocalDate(new Date());

  const [dateFrom, setDateFrom] = useState(shiftDays(-30));
  const [dateTo, setDateTo] = useState(today);
  const [preview, setPreview] = useState(null);

  const [busy, setBusy] = useState(null); // null | 'export' | 'email'
  const [result, setResult] = useState(null);
  const [lastDir, setLastDir] = useState(null);

  const [showMail, setShowMail] = useState(false);
  const [mail, setMail] = useState({
    host: '', port: 587, secure: false, user: '', pass: '', from: '', to: ''
  });
  const [hasPass, setHasPass] = useState(false);
  const [mailSaved, setMailSaved] = useState(false);

  // Настройки почты
  useEffect(() => {
    if (!window.electron) return;
    window.electron.ipcRenderer.invoke('get-email-config').then(cfg => {
      setMail({
        host: cfg.host || '',
        port: cfg.port || 587,
        secure: !!cfg.secure,
        user: cfg.user || '',
        pass: '',
        from: cfg.from || '',
        to: cfg.to || ''
      });
      setHasPass(!!cfg.hasPass);
    });
  }, []);

  // Сколько данных попадёт в отчёт
  useEffect(() => {
    if (!window.electron) return;
    window.electron.ipcRenderer
      .invoke('preview-reports', { dateFrom, dateTo })
      .then(res => setPreview(res.ok ? res : null));
  }, [dateFrom, dateTo]);

  const applyPreset = (from, to) => {
    setDateFrom(from);
    setDateTo(to);
    setResult(null);
  };

  const presets = [
    { label: 'Сегодня', from: today, to: today },
    { label: 'Вчера', from: shiftDays(-1), to: shiftDays(-1) },
    { label: '7 дней', from: shiftDays(-6), to: today },
    { label: '30 дней', from: shiftDays(-29), to: today },
    { label: 'Всё время', from: '', to: '' }
  ];

  const isActivePreset = (p) => p.from === dateFrom && p.to === dateTo;

  const handleExport = () => {
    if (!window.electron) return;
    setBusy('export');
    setResult(null);
    window.electron.ipcRenderer.invoke('export-reports', { dateFrom, dateTo }).then(res => {
      setBusy(null);
      if (res.ok) {
        setLastDir(res.dir);
        setResult({
          type: 'success',
          text: `Готово: ${res.files.length} таблиц, чеков ${res.salesCount}`
        });
      } else {
        setResult({ type: 'error', text: res.error });
      }
    });
  };

  const handleOpenFolder = () => {
    if (window.electron && lastDir) {
      window.electron.ipcRenderer.invoke('open-folder', lastDir);
    }
  };

  const handleSaveMail = () => {
    if (!window.electron) return;
    window.electron.ipcRenderer.invoke('save-email-config', mail).then(res => {
      if (res.ok) {
        if (mail.pass) setHasPass(true);
        setMail(prev => ({ ...prev, pass: '' }));
        setMailSaved(true);
        setTimeout(() => setMailSaved(false), 2000);
      } else {
        setResult({ type: 'error', text: res.error });
      }
    });
  };

  const handleSendEmail = () => {
    if (!window.electron) return;
    setBusy('email');
    setResult(null);
    // Сохраняем настройки перед отправкой — иначе уйдёт по старым
    window.electron.ipcRenderer.invoke('save-email-config', mail).then(() => {
      if (mail.pass) setHasPass(true);
      setMail(prev => ({ ...prev, pass: '' }));
      return window.electron.ipcRenderer.invoke('send-reports-email', { dateFrom, dateTo });
    }).then(res => {
      setBusy(null);
      setResult(res.ok
        ? { type: 'success', text: `Отчёт отправлен на ${res.to}` }
        : { type: 'error', text: res.error });
    });
  };

  const inputCls = 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base';
  const isEmpty = preview && preview.salesCount === 0;

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-5">Экспорт отчётов</h1>

        {/* Период */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <h2 className="text-lg font-bold mb-3">Период</h2>

          <div className="flex flex-wrap gap-2 mb-4">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.from, p.to)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors min-h-[44px] ${
                  isActivePreset(p)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">С даты</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => { setDateFrom(e.target.value); setResult(null); }}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">По дату</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => { setDateTo(e.target.value); setResult(null); }}
                className={inputCls}
              />
            </div>
          </div>

          {preview && (
            <div className={`mt-4 p-3 rounded-xl flex justify-between items-center ${
              isEmpty ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-100'
            }`}>
              {isEmpty ? (
                <span className="text-sm font-bold text-amber-700">
                  За этот период продаж нет
                </span>
              ) : (
                <>
                  <span className="text-sm text-gray-600">
                    Попадёт в отчёт: <b className="text-gray-900">{preview.salesCount}</b> чеков
                  </span>
                  <span className="text-base font-bold text-blue-700">
                    {fmtPrice(preview.revenue)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Что выгружается */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <h2 className="text-lg font-bold mb-1">Таблицы</h2>
          <p className="text-sm text-gray-500 mb-3">
            Формат CSV — открывается в Excel двойным щелчком
          </p>
          <ul className="text-sm text-gray-700 space-y-1.5 mb-4">
            <li>📄 <b>Сводка</b> — выручка, средний чек, разбивка по оплате</li>
            <li>📄 <b>По дням</b> — выручка и число чеков за каждый день</li>
            <li>📄 <b>По товарам</b> — что продавалось, сколько и на какую сумму</li>
            <li>📄 <b>Чеки</b> — каждая позиция каждого чека построчно</li>
          </ul>

          <button
            onClick={handleExport}
            disabled={busy !== null || isEmpty}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors min-h-[52px] active:scale-[0.98] ${
              busy !== null || isEmpty
                ? 'bg-gray-200 text-gray-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {busy === 'export' ? '⏳ Сохраняю...' : '💾 Сохранить в файлы'}
          </button>

          {lastDir && (
            <button
              onClick={handleOpenFolder}
              className="w-full mt-2 py-3 rounded-xl font-bold text-base text-gray-700 bg-gray-100 hover:bg-gray-200 min-h-[48px]"
            >
              📂 Открыть папку с отчётами
            </button>
          )}
        </div>

        {/* Почта */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Отправка на почту</h2>
            <button
              onClick={() => setShowMail(!showMail)}
              className="text-sm text-blue-600 font-bold px-3 py-2 min-h-[44px]"
            >
              {showMail ? 'Скрыть настройки' : 'Настройки'}
            </button>
          </div>

          {showMail && (
            <div className="space-y-3 mb-4 pb-4 border-b border-gray-100">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">SMTP-сервер</label>
                  <input
                    type="text"
                    value={mail.host}
                    onChange={(e) => setMail({ ...mail, host: e.target.value })}
                    placeholder="smtp.yandex.ru"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Порт</label>
                  <input
                    type="number"
                    value={mail.port}
                    onChange={(e) => setMail({ ...mail, port: e.target.value })}
                    placeholder="587"
                    className={inputCls}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={mail.secure}
                  onChange={(e) => setMail({ ...mail, secure: e.target.checked })}
                  className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-base text-gray-700">
                  Шифрование SSL сразу (порт 465). Для порта 587 галочку не ставить
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Логин (адрес отправителя)</label>
                <input
                  type="text"
                  value={mail.user}
                  onChange={(e) => setMail({ ...mail, user: e.target.value })}
                  placeholder="kassa@example.com"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Пароль {hasPass && <span className="text-green-600 font-normal">— сохранён, оставьте пустым чтобы не менять</span>}
                </label>
                <input
                  type="password"
                  value={mail.pass}
                  onChange={(e) => setMail({ ...mail, pass: e.target.value })}
                  placeholder={hasPass ? '••••••••' : 'пароль приложения'}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Кому отправлять</label>
                <input
                  type="text"
                  value={mail.to}
                  onChange={(e) => setMail({ ...mail, to: e.target.value })}
                  placeholder="director@example.com"
                  className={inputCls}
                />
              </div>

              <button
                onClick={handleSaveMail}
                className="w-full py-3 rounded-xl font-bold text-base text-gray-700 bg-gray-100 hover:bg-gray-200 min-h-[48px]"
              >
                {mailSaved ? '✓ Настройки сохранены' : 'Сохранить настройки почты'}
              </button>
            </div>
          )}

          <button
            onClick={handleSendEmail}
            disabled={busy !== null || isEmpty}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors min-h-[52px] active:scale-[0.98] ${
              busy !== null || isEmpty
                ? 'bg-gray-200 text-gray-400'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {busy === 'email' ? '⏳ Отправляю...' : '📧 Отправить отчёт на почту'}
          </button>

          {mail.to && !showMail && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              Получатель: {mail.to}
            </p>
          )}
        </div>

        {result && (
          <div className={`mt-4 p-4 rounded-xl text-center font-bold ${
            result.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {result.type === 'success' ? '✓ ' : '✕ '}{result.text}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportPanel;
