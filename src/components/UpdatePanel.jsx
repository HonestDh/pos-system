import React, { useEffect, useState } from 'react';

const ipc = () => (window.electron ? window.electron.ipcRenderer : null);

/**
 * Панель обновлений. Загрузку и установку кассир запускает сам:
 * установка перезапускает программу, поэтому делать её автоматически
 * посреди смены нельзя.
 *
 * cartCount нужен, чтобы не перезапуститься с незакрытым чеком в корзине.
 */
const UpdatePanel = ({ cartCount = 0 }) => {
  const [status, setStatus] = useState(null);
  const [installError, setInstallError] = useState('');
  const [backupInfo, setBackupInfo] = useState(null);

  useEffect(() => {
    const channel = ipc();
    if (!channel) return;

    channel.invoke('updater-get-status').then(setStatus).catch(() => {});
    channel.invoke('updater-get-backup-info').then(setBackupInfo).catch(() => {});

    const onStatus = (event, next) => setStatus(next);
    channel.on('updater-status', onStatus);
    return () => channel.removeListener('updater-status', onStatus);
  }, []);

  if (!status) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-xl">
        Загрузка...
      </div>
    );
  }

  const check = () => { setInstallError(''); ipc().invoke('updater-check').catch(() => {}); };
  const download = () => { setInstallError(''); ipc().invoke('updater-download').catch(() => {}); };

  const install = () => {
    if (cartCount > 0) {
      setInstallError('Сначала завершите или очистите текущий заказ — программа перезапустится');
      return;
    }
    setInstallError('');
    ipc().invoke('updater-install').catch(() => {});
  };

  const rollback = () => {
    if (cartCount > 0) {
      setInstallError('Сначала завершите или очистите текущий заказ — программа перезапустится');
      return;
    }
    setInstallError('');
    ipc().invoke('updater-rollback').then(result => {
      if (!result.ok) {
        setInstallError(result.reason || 'Ошибка отката');
      }
    }).catch(() => {});
  };

  const busy = status.state === 'checking' || status.state === 'downloading';

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-5">Обновление программы</h1>

        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-500 font-medium">Установленная версия</div>
              <div className="text-3xl font-bold text-gray-900">{status.currentVersion}</div>
            </div>
            <div className="text-5xl">{status.state === 'uptodate' ? '✅' : '🔄'}</div>
          </div>

          {status.state === 'checking' && (
            <div className="p-4 rounded-xl bg-blue-50 text-blue-800 font-bold">
              Проверяем наличие обновлений...
            </div>
          )}

          {status.state === 'idle' && (
            <div className="p-4 rounded-xl bg-gray-50 text-gray-600 font-bold">
              {status.supported
                ? 'Обновления ещё не проверялись'
                : 'Обновления доступны только в установленной версии программы'}
            </div>
          )}

          {status.state === 'uptodate' && (
            <div className="p-4 rounded-xl bg-green-50 text-green-800 font-bold">
              Установлена последняя версия
            </div>
          )}

          {status.state === 'available' && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="font-bold text-amber-900 text-lg">
                Доступна версия {status.version}
              </div>
              {status.notes && (
                <pre className="mt-2 text-sm text-amber-900 whitespace-pre-wrap font-sans">
                  {status.notes}
                </pre>
              )}
            </div>
          )}

          {status.state === 'downloading' && (
            <div className="p-4 rounded-xl bg-blue-50">
              <div className="font-bold text-blue-900 mb-2">
                Загрузка версии {status.version}... {status.percent}%
              </div>
              <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${status.percent}%` }}
                />
              </div>
            </div>
          )}

          {status.state === 'downloaded' && (
            <div className="p-4 rounded-xl bg-green-50 border border-green-200">
              <div className="font-bold text-green-900 text-lg">
                Версия {status.version} загружена
              </div>
              <div className="text-sm text-green-800 mt-1">
                Программа перезапустится при установке. Товары, настройки
                и история продаж сохранятся.
              </div>
            </div>
          )}

          {status.state === 'error' && (
            <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 font-bold">
              {status.error}
            </div>
          )}

          {installError && (
            <div className="mt-3 p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 font-bold">
              {installError}
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={check}
              disabled={busy || !status.supported}
              className="px-6 py-3 rounded-xl font-bold text-base min-h-[48px] bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 active:scale-[0.98]"
            >
              Проверить обновления
            </button>

            {status.state === 'available' && (
              <button
                onClick={download}
                className="px-6 py-3 rounded-xl font-bold text-base min-h-[48px] bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]"
              >
                Загрузить
              </button>
            )}

            {status.state === 'downloaded' && (
              <button
                onClick={install}
                className="px-6 py-3 rounded-xl font-bold text-base min-h-[48px] bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]"
              >
                Установить и перезапустить
              </button>
            )}
          </div>
        </div>

        {backupInfo && backupInfo.hasBackup && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-xl font-bold text-gray-800 mb-3">История версий</h2>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-500 font-medium">Предыдущая версия</div>
                  <div className="text-2xl font-bold text-gray-900">{backupInfo.previous}</div>
                </div>
                <div className="text-4xl">⏪</div>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                Если новая версия работает некорректно, можно откатиться на предыдущую.
                Программа перезапустится. Данные сохранятся.
              </div>
              <button
                onClick={rollback}
                disabled={cartCount > 0}
                className="w-full px-6 py-3 rounded-xl font-bold text-base min-h-[48px] bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400 active:scale-[0.98]"
              >
                Откатить до версии {backupInfo.previous}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdatePanel;
