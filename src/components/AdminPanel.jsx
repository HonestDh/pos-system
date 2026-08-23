import React, { useState } from 'react';
import { fmtPrice } from '../utils/format';
import { VOLUME_OPTIONS, getVolumes, volumeLabel } from '../utils/product';

const AdminPanel = ({ products, categories, onAddProduct, onDeleteProduct, onAddCategory, onDeleteCategory, allFolders }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [newProduct, setNewProduct] = useState({ name: '', image: '📦', selectedFolder: 'root' });
  // Цены по объёмам: { 100: '3.5', 250: '', ... } — пустая строка значит «объём не используется»
  const [prices, setPrices] = useState({});
  const [newCategory, setNewCategory] = useState('');
  const [newCategoryFolder, setNewCategoryFolder] = useState('root');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [formError, setFormError] = useState('');

  const emojis = ['📦', '☕', '🍵', '🍊', '💧', '🍔', '🍕', '🥗', '🍝', '🍩', '🍰', '🍦', '🍟', '🍗', '🍎', '🍌', '🍇', '🍓', '🍒', '🍍'];

  // Получить categories-массив из selectedFolder
  const getProductCategories = () => {
    if (newProduct.selectedFolder === 'root') return [];
    return JSON.parse(newProduct.selectedFolder);
  };

  // Объёмы с заполненной ценой больше нуля
  const filledVolumes = () => VOLUME_OPTIONS
    .filter(ml => {
      const p = parseFloat(String(prices[ml] ?? '').replace(',', '.'));
      return !isNaN(p) && p > 0;
    })
    .map(ml => ({ ml, price: parseFloat(String(prices[ml]).replace(',', '.')) }));

  const setPrice = (ml, value) => {
    setPrices(prev => ({ ...prev, [ml]: value }));
    setFormError('');
  };

  const resetForm = () => {
    setNewProduct({ name: '', image: '📦', selectedFolder: 'root' });
    setPrices({});
    setShowEmojiPicker(false);
    setFormError('');
  };

  const handleAddProduct = () => {
    const volumes = filledVolumes();

    if (!newProduct.name.trim()) {
      setFormError('Укажите название товара');
      return;
    }
    if (volumes.length === 0) {
      setFormError('Укажите цену хотя бы для одного объёма');
      return;
    }

    onAddProduct({
      name: newProduct.name.trim(),
      categories: getProductCategories(),
      image: newProduct.image,
      volumes,
      // Базовая цена = самый маленький объём: пригодится, если товар
      // когда-нибудь окажется в коде, не знающем про volumes
      price: volumes[0].price
    });
    resetForm();
  };

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      const parentPath = newCategoryFolder === 'root'
        ? []
        : JSON.parse(newCategoryFolder);
      onAddCategory(newCategory.trim(), parentPath);
      setNewCategory('');
    }
  };

  // Форматировать путь для отображения в select
  const formatFolder = (path) => {
    if (path.length === 0) return '(корень)';
    return path.join(' / ');
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex gap-3 mb-5">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-7 py-3 rounded-xl font-bold text-base transition-colors min-h-[48px] ${
              activeTab === 'products'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-900 hover:bg-gray-100 shadow-sm'
            }`}
          >
            🛒 Товары
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-7 py-3 rounded-xl font-bold text-base transition-colors min-h-[48px] ${
              activeTab === 'categories'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-900 hover:bg-gray-100 shadow-sm'
            }`}
          >
            🗂️ Категории
          </button>
        </div>

        {activeTab === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold mb-4">Добавить товар</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Название товара"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Категория</label>
                  <select
                    value={newProduct.selectedFolder}
                    onChange={(e) => setNewProduct({ ...newProduct, selectedFolder: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base"
                  >
                    <option value="root">📁 Корневая папка</option>
                    {allFolders.map(folder => (
                      <option key={folder.name} value={JSON.stringify(folder.path)}>
                        📁 {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Объёмы стакана: цена задаётся для каждого нужного объёма.
                    Пустое поле означает, что этот объём у товара не продаётся. */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Цены по объёмам
                  </label>
                  <div className="space-y-2">
                    {VOLUME_OPTIONS.map(ml => {
                      const active = String(prices[ml] ?? '').trim() !== '';
                      return (
                        <div
                          key={ml}
                          className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-colors ${
                            active ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <span className={`w-20 text-center font-bold shrink-0 ${
                            active ? 'text-blue-700' : 'text-gray-400'
                          }`}>
                            {ml} мл
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            min="0"
                            placeholder="цена"
                            value={prices[ml] ?? ''}
                            onChange={(e) => setPrice(ml, e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base bg-white"
                          />
                          {active && (
                            <button
                              onClick={() => setPrice(ml, '')}
                              className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg shrink-0"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Заполните только те объёмы, которые продаются. Если задан один —
                    товар добавляется в корзину сразу, если несколько — кассир выберет объём.
                  </p>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Иконка</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProduct.image}
                      readOnly
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-lg"
                    />
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-xl min-w-[48px]"
                    >
                      🎨
                    </button>
                  </div>
                  {showEmojiPicker && (
                    <div className="absolute z-10 mt-2 p-3 bg-white border border-gray-200 rounded-xl shadow-lg grid grid-cols-5 gap-2">
                      {emojis.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => setNewProduct({ ...newProduct, image: emoji })}
                          className="text-3xl hover:bg-gray-100 rounded-lg p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm font-bold">
                    {formError}
                  </div>
                )}

                <button
                  onClick={handleAddProduct}
                  className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 font-bold text-base transition-colors active:scale-[0.98] min-h-[48px]"
                >
                  Добавить товар
                </button>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200">
                  <h2 className="text-lg font-bold">Список товаров ({products.length})</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {products.map(product => (
                    <div key={product.id} className="p-4 flex items-center justify-between hover:bg-gray-50 gap-2">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className="text-3xl flex-shrink-0">{product.image}</span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm truncate">{product.name}</h3>
                          <p className="text-sm text-gray-500 truncate">
                            {Array.isArray(product.categories) && product.categories.length > 0
                              ? product.categories.join(' / ')
                              : 'Корневая папка'}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {getVolumes(product).map(v => (
                              <span
                                key={v.ml ?? 'base'}
                                className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-bold"
                              >
                                {v.label ? `${v.label} — ` : ''}{fmtPrice(v.price)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteProduct(product.id)}
                        className="text-red-500 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {products.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                      Нет товаров
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold mb-4">Добавить категорию</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Родительская папка</label>
                  <select
                    value={newCategoryFolder}
                    onChange={(e) => setNewCategoryFolder(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base"
                  >
                    <option value="root">📁 Корневая папка</option>
                    {allFolders.map(folder => (
                      <option key={folder.name} value={JSON.stringify(folder.path)}>
                        📁 {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Название категории"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory(); }}
                  />
                  <button
                    onClick={handleAddCategory}
                    className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-bold text-base transition-colors min-h-[48px]"
                  >
                    Добавить
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold mb-4">Категории</h2>
              <div className="space-y-2">
                {categories.length > 0 ? (
                  <CategoryList
                    categories={categories}
                    onDeleteCategory={onDeleteCategory}
                  />
                ) : (
                  <p className="text-gray-400 text-base">Нет категорий</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CategoryList = ({ categories, onDeleteCategory }) => (
  <div className="space-y-2">
    {categories.map(category => (
      <div key={category.name} className="flex items-center gap-3 bg-gray-100 px-5 py-3 rounded-xl">
        <span className="font-bold text-gray-900 text-sm flex-1">{category.name}</span>
        <button
          onClick={() => onDeleteCategory(category)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg p-2 min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
        >
          ✕
        </button>
        {category.children && category.children.length > 0 && (
          <div className="ml-4 flex-1">
            <CategoryList categories={category.children} onDeleteCategory={onDeleteCategory} />
          </div>
        )}
      </div>
    ))}
  </div>
);

export default AdminPanel;
