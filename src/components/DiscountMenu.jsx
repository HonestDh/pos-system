import React from 'react';

/**
 * Контекстное меню для применения скидки к товару в корзине.
 * Появляется при долгом нажатии на товар.
 */
const DiscountMenu = ({ item, position, discounts, onApply, onClose }) => {
  if (!item) return null;

  return (
    <>
      {/* Оверлей для закрытия меню */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />

      {/* Контекстное меню */}
      <div
        className="fixed z-50 bg-white rounded-xl shadow-2xl border-2 border-gray-200 py-2 min-w-[200px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'translate(-50%, -10px)'
        }}
      >
        <div className="px-4 py-2 border-b border-gray-200">
          <div className="font-bold text-sm text-gray-900 truncate">{item.name}</div>
          <div className="text-xs text-gray-500">Выберите скидку</div>
        </div>

        <div className="py-1">
          {discounts.map(discount => (
            <button
              key={discount}
              onClick={() => onApply(item.lineId, discount)}
              className="w-full px-4 py-2.5 text-left hover:bg-blue-50 active:bg-blue-100 flex items-center justify-between group"
            >
              <span className="font-bold text-base text-gray-900 group-hover:text-blue-600">
                {discount === 100 ? 'Бесплатно' : `Скидка ${discount}%`}
              </span>
              <span className="text-xl group-hover:scale-110 transition-transform">
                {discount === 100 ? '🎁' : '💰'}
              </span>
            </button>
          ))}
        </div>

        {item.discount > 0 && (
          <>
            <div className="border-t border-gray-200 my-1" />
            <button
              onClick={() => onApply(item.lineId, 0)}
              className="w-full px-4 py-2.5 text-left hover:bg-red-50 active:bg-red-100 text-red-600 font-bold"
            >
              Убрать скидку
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default DiscountMenu;
