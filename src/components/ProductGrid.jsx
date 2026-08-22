import React from 'react';
import { fmtPrice } from '../utils/format';

const ProductGrid = ({ products, categories, addToCart, onCategoryClick }) => {
  if (products.length === 0 && categories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-xl">
        Товары не найдены
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {categories.map(category => (
          <button
            key={category.name}
            onClick={() => onCategoryClick(category.name)}
            className="aspect-square bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-2 flex flex-col overflow-hidden active:scale-95"
          >
            {/* Иконка занимает всё место, не занятое подписью */}
            <div className="flex-1 min-h-0 flex items-center justify-center text-5xl leading-none">
              📁
            </div>
            {/* shrink-0 + line-clamp-2 — высота подписи ограничена сверху,
                поэтому иконке всегда остаётся предсказуемое место */}
            <h3 className="shrink-0 font-bold text-gray-900 text-base text-center line-clamp-2 leading-tight">
              {category.name}
            </h3>
          </button>
        ))}
        {products.map(product => (
          <button
            key={product.id}
            onClick={() => addToCart(product)}
            className="aspect-square bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-2 flex flex-col overflow-hidden group active:scale-95"
          >
            <div className="flex-1 min-h-0 flex items-center justify-center text-5xl leading-none group-hover:scale-110 transition-transform">
              {product.image}
            </div>
            <div className="shrink-0 text-center">
              <h3 className="font-bold text-gray-900 text-base line-clamp-2 leading-tight">
                {product.name}
              </h3>
              <p className="text-blue-600 font-bold text-lg leading-tight mt-0.5">
                {fmtPrice(product.price)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProductGrid;
