import React from 'react';
import { fmtPrice } from '../utils/format';
import { getVolumes } from '../utils/product';

/**
 * Выбор объёма стакана при добавлении товара в корзину.
 * Показывается только когда у товара задано больше одного объёма.
 */
const VolumeDialog = ({ product, onPick, onCancel }) => {
  const volumes = getVolumes(product);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
        <div className="text-center mb-4">
          <div className="text-5xl mb-2">{product.image}</div>
          <h2 className="text-xl font-bold text-gray-900">{product.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Выберите объём</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {volumes.map(v => (
            <button
              key={v.ml}
              onClick={() => onPick(v)}
              className="bg-gray-50 hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-400 rounded-xl p-4 flex flex-col items-center gap-1 active:scale-95 min-h-[92px]"
            >
              <span className="text-2xl font-bold text-gray-900">{v.ml}</span>
              <span className="text-xs text-gray-500 leading-none">мл</span>
              <span className="text-lg font-bold text-blue-600 mt-1">{fmtPrice(v.price)}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full mt-4 py-3 rounded-xl font-bold text-base text-gray-600 bg-gray-50 hover:bg-gray-100 min-h-[48px]"
        >
          Отмена
        </button>
      </div>
    </div>
  );
};

export default VolumeDialog;
