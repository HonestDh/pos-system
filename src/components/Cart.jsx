import React, { useState, useRef } from 'react';
import { fmtPrice } from '../utils/format';
import DiscountMenu from './DiscountMenu';

const Cart = ({ cart, removeFromCart, updateQuantity, applyDiscount, cartTotal, discounts }) => {
  const [contextMenu, setContextMenu] = useState(null);
  const longPressTimer = useRef(null);
  const longPressThreshold = 500; // 500ms для долгого нажатия

  const handleTouchStart = (item, e) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      setContextMenu({
        item,
        position: { x: touch.clientX, y: touch.clientY }
      });
    }, longPressThreshold);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMouseDown = (item, e) => {
    // Только левая кнопка мыши для долгого нажатия
    if (e.button !== 0) return;

    console.log('[DiscountMenu] Mouse down on item:', item.name);

    longPressTimer.current = setTimeout(() => {
      console.log('[DiscountMenu] Opening menu for:', item.name);
      setContextMenu({
        item,
        position: { x: e.clientX, y: e.clientY }
      });
    }, longPressThreshold);
  };

  const handleMouseUp = () => {
    console.log('[DiscountMenu] Mouse up, clearing timer');
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMouseLeave = () => {
    console.log('[DiscountMenu] Mouse leave, clearing timer');
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleContextMenu = (item, e) => {
    e.preventDefault();
    console.log('[DiscountMenu] Context menu (right click) for:', item.name);
    setContextMenu({
      item,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  const handleApplyDiscount = (lineId, discount) => {
    applyDiscount(lineId, discount);
    setContextMenu(null);
  };

  if (cart.length === 0) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-6 flex-1 flex flex-col items-center justify-center text-gray-400">
          <div className="text-6xl mb-4">🛒</div>
          <p className="text-lg font-medium">Корзина пуста</p>
          <p className="text-sm mt-1 text-gray-400">Добавьте товары</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      <div className="p-5 border-b border-gray-200">
        <h2 className="font-bold text-xl">Корзина ({cart.length})</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {cart.map(item => {
          const finalPrice = item.discount > 0
            ? item.price * (1 - item.discount / 100)
            : item.price;

          return (
            <div
              key={item.lineId}
              className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100 gap-2"
            >
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onTouchStart={(e) => handleTouchStart(item, e)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                onMouseDown={(e) => handleMouseDown(item, e)}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onContextMenu={(e) => handleContextMenu(item, e)}
              >
                <h3 className="font-bold text-gray-900 text-sm truncate">
                  {item.name}
                  {item.volumeLabel && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs align-middle">
                      {item.volumeLabel}
                    </span>
                  )}
                  {item.discount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs align-middle font-bold">
                      {item.discount === 100 ? '🎁' : `-${item.discount}%`}
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.discount > 0 && (
                    <span className="text-gray-400 line-through text-xs">
                      {fmtPrice(item.price * item.quantity)}
                    </span>
                  )}
                  <span className={`font-bold text-sm ${item.discount > 0 ? 'text-green-600' : 'text-blue-600'}`}>
                    {fmtPrice(finalPrice * item.quantity)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => updateQuantity(item.lineId, -1)}
                  className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-xl hover:bg-gray-200 text-lg font-bold active:scale-95"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold text-base">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.lineId, 1)}
                  className="w-11 h-11 flex items-center justify-center bg-blue-100 rounded-xl hover:bg-blue-200 text-lg font-bold text-blue-600 active:scale-95"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => removeFromCart(item.lineId)}
                className="w-11 h-11 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl active:scale-95"
              >
                <span className="text-xl">✕</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-5 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 font-medium text-base">Итого:</span>
          <span className="text-2xl font-bold text-gray-800">{fmtPrice(cartTotal)}</span>
        </div>
      </div>

      {contextMenu && (
        <DiscountMenu
          item={contextMenu.item}
          position={contextMenu.position}
          discounts={discounts}
          onApply={handleApplyDiscount}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};

export default Cart;
