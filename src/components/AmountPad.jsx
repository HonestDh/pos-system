import React, { useState } from 'react';
import NumPad from './NumPad';
import { fmtPrice } from '../utils/format';

/**
 * Модальный ввод денежной суммы с экранной клавиатурой.
 *
 * Значения снаружи всегда в виде строки с точкой ("12.5"), чтобы parseFloat
 * работал везде одинаково. Внутри для показа используется запятая.
 */
const AmountPad = ({ title, initialValue, dueAmount, onConfirm, onCancel, onPayment }) => {
  // Приводим входное значение к виду для показа: точка -> запятая
  const [draft, setDraft] = useState(() => {
    const v = String(initialValue ?? '').trim();
    return v ? v.replace('.', ',') : '';
  });

  const toNumber = (text) => parseFloat(String(text).replace(',', '.')) || 0;
  const value = toNumber(draft);

  // Округляем: due приходит из вычитания и может нести мусор плавающей точки
  const due = typeof dueAmount === 'number'
    ? Math.round(dueAmount * 100) / 100
    : null;

  const handleDigit = (d) => {
    setDraft(prev => {
      // Не даём больше двух знаков после запятой
      const dot = prev.indexOf(',');
      if (dot !== -1 && prev.length - dot > 2) return prev;
      // Не даём разрастаться целой части
      if (dot === -1 && prev.replace(/^0+/, '').length >= 7) return prev;
      // Ведущий ноль заменяем, а не дописываем к нему
      if (prev === '0') return d;
      return prev + d;
    });
  };

  const handleDecimal = () => {
    setDraft(prev => {
      if (prev.includes(',')) return prev;
      return prev === '' ? '0,' : prev + ',';
    });
  };

  const handleBackspace = () => setDraft(prev => prev.slice(0, -1));
  const handleClear = () => setDraft('');

  // Быстрые суммы — по одному нажатию вместо набора по цифрам
  const quickAmounts = [10, 20, 50, 100, 200, 500];

  const remaining = due !== null ? Math.round((due - value) * 100) / 100 : null;

  const confirm = () => {
    // Наружу отдаём с точкой; пустой ввод -> пустая строка
    const text = draft.trim();
    onConfirm(text === '' ? '' : String(toNumber(text)));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <h2 className="text-lg font-bold text-gray-900 text-center mb-3">{title}</h2>

        {/* Текущее значение. Это не <input>, поэтому клавиатура Windows
            не вызывается — ввод только через экранные кнопки ниже. */}
        <div className="mb-3 px-4 py-3 bg-gray-50 border-2 border-blue-500 rounded-xl text-right">
          <div className="text-3xl font-bold text-gray-900 leading-none">
            {draft === '' ? '0' : draft}
            <span className="text-xl text-gray-400 ml-1">Br</span>
          </div>
        </div>

        {due !== null && (
          <div className="mb-3 flex justify-between text-sm px-1">
            <span className="text-gray-500">К оплате: {fmtPrice(due)}</span>
            <span className={`font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {remaining > 0 ? `Не хватает ${fmtPrice(remaining)}` : `Сдача ${fmtPrice(-remaining)}`}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          {quickAmounts.map(a => (
            <button
              key={a}
              onClick={() => setDraft(String(a))}
              className="flex-1 px-2 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-bold active:scale-95 min-h-[40px]"
            >
              {a}
            </button>
          ))}
          {due !== null && due > 0 && (
            <button
              onClick={() => setDraft(String(due).replace('.', ','))}
              className="w-full px-2 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-bold active:scale-95 min-h-[40px]"
            >
              Без сдачи — {fmtPrice(due)}
            </button>
          )}
        </div>

        <NumPad
          onDigit={handleDigit}
          onDecimal={handleDecimal}
          onBackspace={handleBackspace}
          bottomLeft="decimal"
        />

        <div className="grid grid-cols-3 gap-2.5 mt-3">
          <button
            onClick={handleClear}
            className="py-3 rounded-xl font-bold text-base text-gray-600 bg-gray-50 hover:bg-gray-100 min-h-[48px]"
          >
            Сброс
          </button>
          <button
            onClick={onCancel}
            className="py-3 rounded-xl font-bold text-base text-gray-600 bg-gray-50 hover:bg-gray-100 min-h-[48px]"
          >
            Отмена
          </button>
          <button
            onClick={confirm}
            className="py-3 rounded-xl font-bold text-base text-white bg-blue-600 hover:bg-blue-700 min-h-[48px]"
          >
            Готово
          </button>
        </div>
        {onPayment && (
          <button
            onClick={() => onPayment(value)}
            disabled={due !== null && value < due}
            className={`w-full mt-2.5 py-3 rounded-xl font-bold text-base min-h-[48px] ${
              due !== null && value < due
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            💰 Оплатить
          </button>
        )}
      </div>
    </div>
  );
};

export default AmountPad;
