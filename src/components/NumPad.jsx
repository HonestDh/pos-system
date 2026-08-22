import React from 'react';

/**
 * Экранная цифровая клавиатура для планшета.
 * Используется и для PIN-кода, и для ввода сумм — своя клавиатура надёжнее,
 * чем ждать системную, и не перекрывает интерфейс.
 *
 * bottomLeft: 'clear'   — кнопка «Сброс» (для PIN)
 *             'decimal' — кнопка запятой (для сумм)
 */
const NumPad = ({ onDigit, onBackspace, onClear, onDecimal, bottomLeft = 'clear', disabled = false }) => {
  const keyCls = 'py-4 rounded-xl text-2xl font-bold active:scale-95 min-h-[60px] disabled:opacity-40';
  const digitCls = `${keyCls} bg-gray-100 hover:bg-gray-200 text-gray-900`;
  const auxCls = `${keyCls} bg-gray-50 hover:bg-gray-100 text-gray-500`;

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
        <button
          key={d}
          onClick={() => onDigit(String(d))}
          disabled={disabled}
          className={digitCls}
        >
          {d}
        </button>
      ))}

      {bottomLeft === 'decimal' ? (
        <button onClick={onDecimal} disabled={disabled} className={digitCls}>
          ,
        </button>
      ) : (
        <button onClick={onClear} disabled={disabled} className={`${auxCls} text-base`}>
          Сброс
        </button>
      )}

      <button onClick={() => onDigit('0')} disabled={disabled} className={digitCls}>
        0
      </button>

      <button onClick={onBackspace} disabled={disabled} className={auxCls}>
        ⌫
      </button>
    </div>
  );
};

export default NumPad;
