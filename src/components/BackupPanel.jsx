import React, { useState, useEffect } from 'react';

const BackupPanel = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const loadBackups = () => {
    if (window.electron) {
      window.electron.ipcRenderer.invoke('list-backups').then(setBackups);
    }
  };

  useEffect(() => { loadBackups(); }, []);

  const handleBackup = () => {
    if (!window.electron) return;
    setLoading(true);
    setResult(null);
    window.electron.ipcRenderer.invoke('backup').then(res => {
      setLoading(false);
      if (res.ok) {
        setResult({ type: 'success', text: `✓ Резервная копия создана: ${res.fileName}` });
      } else {
        setResult({ type: 'error', text: `✕ ${res.error}` });
      }
      loadBackups();
    });
  };

  const handleRestore = (fileName) => {
    if (!window.electron) return;
    if (!confirm(`Восстановить из резервной копии "${fileName}"?\n\nТекущие данные будут заменены.`)) return;
    setLoading(true);
    setResult(null);
    window.electron.ipcRenderer.invoke('restore', fileName).then(res => {
      setLoading(false);
      if (res.ok) {
        setResult({ type: 'success', text: `✓ Данные восстановлены из ${res.fileName}` });
      } else {
        setResult({ type: 'error', text: `✕ ${res.error}` });
      }
    });
  };

  const handleDelete = (fileName) => {
    if (!window.electron) return;
    if (!confirm(`Удалить резервную копию "${fileName}"?`)) return;
    window.electron.ipcRenderer.invoke('delete-backup', fileName).then(loadBackups);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  };

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleString('ru-RU');
  };

  const fileNameWithoutExt = (name) => name.replace('.json', '');

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-5">Резервное копирование</h1>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-5">
          <h2 className="text-lg font-bold mb-4">Создать резервную копию</h2>
          <p className="text-sm text-gray-500 mb-4">
            Сохраняет товары, категории, продажи и настройки принтера в JSON-файл
          </p>
          <button
            onClick={handleBackup}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors min-h-[52px] active:scale-[0.98] ${
              loading
                ? 'bg-gray-200 text-gray-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? '⏳ Создаю...' : '💾 Создать резервную копию'}
          </button>

          {result && (
            <div className={`mt-4 p-4 rounded-xl font-bold text-center ${
              result.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {result.text}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Существующие резервные копии</h2>

          {backups.length === 0 ? (
            <p className="text-gray-400 text-base text-center py-8">
              Пока нет резервных копий
            </p>
          ) : (
            <div className="space-y-2">
              {backups.map(backup => {
                const label = fileNameWithoutExt(backup.name);
                return (
                  <div
                    key={backup.name}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl"
                  >
                    <span className="text-2xl">💾</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-sm truncate">{label}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(backup.date)} • {formatSize(backup.size)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestore(backup.name)}
                      disabled={loading}
                      className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      Восстановить
                    </button>
                    <button
                      onClick={() => handleDelete(backup.name)}
                      className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-5 p-5 bg-blue-50 rounded-xl border border-blue-100">
          <h3 className="font-bold text-blue-800 mb-2 text-base">ℹ️ Информация</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Резервные копии хранятся в папке пользователя (UserData)</li>
            <li>• Рекомендуемая частота: ежедневно или перед важным обновлением</li>
            <li>• Восстановление заменит все текущие данные данными из резервной копии</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BackupPanel;
