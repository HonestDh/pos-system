import React, { useState } from 'react';

/**
 * Редактор списка доступных скидок.
 * Позволяет добавлять и удалять процентные скидки.
 */
const DiscountEditor = ({ discounts, onUpdate }) => {
  const [newDiscount, setNewDiscount] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    const value = parseInt(newDiscount);

    if (!newDiscount.trim()) {
      setError('Введите процент скидки');
      return;
    }

    if (isNaN(value) || value <= 0 || value > 100) {
      setError('Скидка должна быть от 1% до 100%');
      return;
    }

    if (discounts.includes(value)) {
      setError('Такая скидка уже существует');
      return;
    }

    const updated = [...discounts, value].sort((a, b) => a - b);
    onUpdate(updated);
    setNewDiscount('');
    setError('');
  };

  const handleRemove = (discount) => {
    const updated = discounts.filter(d => d !== discount);
    onUpdate(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Процент скидки (1-100)"
          value={newDiscount}
          onChange={(e) => { setNewDiscount(e.target.value); setError(''); }}
          onKeyPress={(e) => { if (e.key === 'Enter') handleAdd(); }}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base"
          min="1"
          max="100"
        />
        <button
          onClick={handleAdd}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 min-h-[48px]"
        >
          Добавить
        </button>
      </div>

      {error && (
        <div className="text-red-600 text-sm font-medium">{error}</div>
      )}

      <div className="space-y-2">
        <h3 className="font-bold text-sm text-gray-700">Доступные скидки:</h3>
        {discounts.length > 0 ? (
          <div className="space-y-2">
            {discounts.map(discount => (
              <div
                key={discount}
                className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-xl border border-gray-200"
              >
                <span className="font-bold text-base text-gray-900">
                  {discount === 100 ? '🎁 Бесплатно (100%)' : `💰 Скидка ${discount}%`}
                </span>
                <button
                  onClick={() => handleRemove(discount)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg px-3 py-2 min-h-[44px] font-bold"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-base">Нет настроенных скидок</p>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
        <div className="text-sm text-blue-900">
          <strong>Как использовать:</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Долгое нажатие на товар в корзине откроет меню</li>
            <li>Выберите нужную скидку из списка</li>
            <li>Скидка применится к выбранному товару</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DiscountEditor;
