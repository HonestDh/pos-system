import React from 'react';

const Header = ({ onGoHome, showHome, onOptionsSelect, onExit }) => {
  const [time, setTime] = React.useState(new Date());
  const [showOptions, setShowOptions] = React.useState(false);

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-white shadow-sm px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-gray-800">POS System</h1>
        <p className="text-sm text-gray-500 font-medium">
          {time.toLocaleDateString('ru-RU')} {time.toLocaleTimeString('ru-RU')}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {showHome && (
          <button
            onClick={onGoHome}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold flex items-center gap-2 min-h-[44px] active:scale-95"
          >
            <span>🏠</span>
            <span>Главная</span>
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-bold flex items-center gap-2 min-h-[44px] active:scale-95"
            aria-label="Опции"
          >
            <span className="text-lg">⚙️</span>
            <span>Опции</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showOptions && (
            <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
              <button
                onClick={() => { onOptionsSelect('admin'); setShowOptions(false); }}
                className="w-full text-left px-5 py-4 text-base text-gray-700 hover:bg-gray-100 flex items-center gap-3 border-b border-gray-100"
              >
                <span className="text-xl">🔐</span>
                <span>Админка</span>
              </button>
              <button
                onClick={() => { onOptionsSelect('stats'); setShowOptions(false); }}
                className="w-full text-left px-5 py-4 text-base text-gray-700 hover:bg-gray-100 flex items-center gap-3 border-b border-gray-100"
              >
                <span className="text-xl">📊</span>
                <span>Статистика</span>
              </button>
              <button
                onClick={() => { onOptionsSelect('export'); setShowOptions(false); }}
                className="w-full text-left px-5 py-4 text-base text-gray-700 hover:bg-gray-100 flex items-center gap-3 border-b border-gray-100"
              >
                <span className="text-xl">📤</span>
                <span>Экспорт отчётов</span>
              </button>
              <button
                onClick={() => { onOptionsSelect('printer'); setShowOptions(false); }}
                className="w-full text-left px-5 py-4 text-base text-gray-700 hover:bg-gray-100 flex items-center gap-3 border-b border-gray-100"
              >
                <span className="text-xl">🖨️</span>
                <span>Принтер</span>
              </button>
              <button
                onClick={() => { onOptionsSelect('backup'); setShowOptions(false); }}
                className="w-full text-left px-5 py-4 text-base text-gray-700 hover:bg-gray-100 flex items-center gap-3 border-b border-gray-100"
              >
                <span className="text-xl">💾</span>
                <span>Резервное копирование</span>
              </button>
              <button
                onClick={() => { onExit(); setShowOptions(false); }}
                className="w-full text-left px-5 py-4 text-base text-red-600 hover:bg-red-50 flex items-center gap-3"
              >
                <span className="text-xl">✕</span>
                <span>Закрыть программу</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
