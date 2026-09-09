import React, { useState } from 'react';
import { fmtPrice } from '../utils/format';
import { VOLUME_OPTIONS, UNIT_VOLUME, UNIT_WEIGHT, getVariants } from '../utils/product';
import DiscountEditor from './DiscountEditor';

const num = (value) => parseFloat(String(value ?? '').replace(',', '.'));

const AdminPanel = ({ products, categories, onAddProduct, onDeleteProduct, onUpdateProduct, onAddCategory, onDeleteCategory, allFolders, discounts, onUpdateDiscounts }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [newProduct, setNewProduct] = useState({ name: '', image: '📦', selectedFolder: 'root' });
  // Тип товара: напитки продаются по объёму, десерты — по массе
  const [unit, setUnit] = useState(UNIT_VOLUME);
  // Цены по объёмам: { 100: '3.5', 250: '', ... } — пустая строка значит «объём не используется»
  const [prices, setPrices] = useState({});
  // Свой объём, которого нет в списке предлагаемых
  const [customVolume, setCustomVolume] = useState({ size: '', price: '' });
  // Масса порции: одно поле. Пустая или нулевая масса допустима —
  // тогда товар продаётся без указания массы (штучно)
  const [weight, setWeight] = useState({ size: '', price: '' });
  const [newCategory, setNewCategory] = useState('');
  const [newCategoryFolder, setNewCategoryFolder] = useState('root');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [formError, setFormError] = useState('');
  // Режим редактирования товара
  const [editingProduct, setEditingProduct] = useState(null);

  const emojis = ['📦', '☕', '🍵', '🍊', '💧', '🍔', '🍕', '🥗', '🍝', '🍩', '🍰', '🍦', '🍟', '🍗', '🍎', '🍌', '🍇', '🍓', '🍒', '🍍'];

  // Получить categories-массив из selectedFolder
  const getProductCategories = () => {
    if (newProduct.selectedFolder === 'root') return [];
    return JSON.parse(newProduct.selectedFolder);
  };

  /**
   * Варианты товара в том виде, в котором они уходят в конфиг:
   * у объёмных — { ml, price }, у весовых — { g, price }.
   * Масса 0 допустима: такой вариант нигде не подписывается.
   */
  const buildVariants = () => {
    if (unit === UNIT_WEIGHT) {
      const price = num(weight.price);
      if (!(price > 0)) return [];
      return [{ g: num(weight.size) > 0 ? num(weight.size) : 0, price }];
    }

    const list = VOLUME_OPTIONS
      .filter(ml => num(prices[ml]) > 0)
      .map(ml => ({ ml, price: num(prices[ml]) }));

    const extraSize = num(customVolume.size);
    const extraPrice = num(customVolume.price);
    // Свой объём добавляем, только если заданы и объём, и цена,
    // и такого объёма ещё нет среди предлагаемых
    if (extraSize > 0 && extraPrice > 0 && !list.some(v => v.ml === extraSize)) {
      list.push({ ml: extraSize, price: extraPrice });
    }
    return list.sort((a, b) => a.ml - b.ml);
  };

  const setPrice = (ml, value) => {
    setPrices(prev => ({ ...prev, [ml]: value }));
    setFormError('');
  };

  const resetForm = () => {
    setNewProduct({ name: '', image: '📦', selectedFolder: 'root' });
    setPrices({});
    setCustomVolume({ size: '', price: '' });
    setWeight({ size: '', price: '' });
    setUnit(UNIT_VOLUME);
    setShowEmojiPicker(false);
    setFormError('');
    setEditingProduct(null);
  };

  const handleAddProduct = () => {
    const volumes = buildVariants();

    if (!newProduct.name.trim()) {
      setFormError('Укажите название товара');
      return;
    }
    if (volumes.length === 0) {
      setFormError(unit === UNIT_WEIGHT
        ? 'Укажите цену товара'
        : 'Укажите цену хотя бы для одного объёма');
      return;
    }

    const productData = {
      name: newProduct.name.trim(),
      categories: getProductCategories(),
      image: newProduct.image,
      unit,
      volumes,
      price: volumes[0].price
    };

    if (editingProduct) {
      onUpdateProduct({ ...editingProduct, ...productData });
    } else {
      onAddProduct(productData);
    }
    resetForm();
  };

  const switchUnit = (next) => {
    setUnit(next);
    setFormError('');
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name || '',
      image: product.image || '📦',
      selectedFolder: product.categories && product.categories.length > 0
        ? JSON.stringify(product.categories)
        : 'root'
    });
    setUnit(product.unit || UNIT_VOLUME);

    // Восстанавливаем цены
    const newPrices = {};
    const newWeight = { size: '', price: '' };
    const newCustomVolume = { size: '', price: '' };

    if (Array.isArray(product.volumes)) {
      product.volumes.forEach(v => {
        if (product.unit === UNIT_WEIGHT) {
          newWeight.size = String(v.g || '');
          newWeight.price = String(v.price || '');
        } else {
          if (VOLUME_OPTIONS.includes(v.ml)) {
            newPrices[v.ml] = String(v.price || '');
          } else {
            newCustomVolume.size = String(v.ml || '');
            newCustomVolume.price = String(v.price || '');
          }
        }
      });
    }

    setPrices(newPrices);
    setWeight(newWeight);
    setCustomVolume(newCustomVolume);
    setShowEmojiPicker(false);
    setFormError('');
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
          <button
            onClick={() => setActiveTab('discounts')}
            className={`px-7 py-3 rounded-xl font-bold text-base transition-colors min-h-[48px] ${
              activeTab === 'discounts'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-900 hover:bg-gray-100 shadow-sm'
            }`}
          >
            💰 Скидки
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
                {/* Тип товара определяет, чем задаётся размер порции:
                    объёмом стакана (напитки) или массой (десерты) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Тип товара</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => switchUnit(UNIT_VOLUME)}
                      className={`py-3 rounded-xl font-bold text-base min-h-[48px] border-2 transition-colors ${
                        unit === UNIT_VOLUME
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      🥤 По объёму
                    </button>
                    <button
                      onClick={() => switchUnit(UNIT_WEIGHT)}
                      className={`py-3 rounded-xl font-bold text-base min-h-[48px] border-2 transition-colors ${
                        unit === UNIT_WEIGHT
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      🍰 По массе
                    </button>
                  </div>
                </div>

                {/* Объёмы стакана: цена задаётся для каждого нужного объёма.
                    Пустое поле означает, что этот объём у товара не продаётся. */}
                {unit === UNIT_VOLUME && (
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

                    {/* Свой объём — для нестандартной посуды */}
                    <div className={`flex items-center gap-2 p-2 rounded-xl border-2 border-dashed transition-colors ${
                      String(customVolume.price).trim() !== ''
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        placeholder="свой, мл"
                        value={customVolume.size}
                        onChange={(e) => { setCustomVolume({ ...customVolume, size: e.target.value }); setFormError(''); }}
                        className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-base bg-white text-center shrink-0"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        placeholder="цена"
                        value={customVolume.price}
                        onChange={(e) => { setCustomVolume({ ...customVolume, price: e.target.value }); setFormError(''); }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base bg-white"
                      />
                      {(String(customVolume.size).trim() !== '' || String(customVolume.price).trim() !== '') && (
                        <button
                          onClick={() => setCustomVolume({ size: '', price: '' })}
                          className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg shrink-0"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Заполните только те объёмы, которые продаются. Если задан один —
                    товар добавляется в корзину сразу, если несколько — кассир выберет объём.
                  </p>
                </div>
                )}

                {/* Масса: одно поле. Если масса не указана или равна нулю,
                    товар нигде не подписывается массой — ни на экране, ни в чеке. */}
                {unit === UNIT_WEIGHT && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Масса и цена
                  </label>
                  <div className="flex items-center gap-2 p-2 rounded-xl border-2 border-gray-200 bg-gray-50">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="1"
                      min="0"
                      placeholder="масса, г"
                      value={weight.size}
                      onChange={(e) => { setWeight({ ...weight, size: e.target.value }); setFormError(''); }}
                      className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-base bg-white text-center shrink-0"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="цена"
                      value={weight.price}
                      onChange={(e) => { setWeight({ ...weight, price: e.target.value }); setFormError(''); }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base bg-white"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Массу можно не указывать — тогда товар продаётся штучно
                    и масса не выводится ни на экране, ни в чеке.
                  </p>
                </div>
                )}

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
                  {editingProduct ? 'Сохранить изменения' : 'Добавить товар'}
                </button>
                {editingProduct && (
                  <button
                    onClick={resetForm}
                    className="w-full mt-3 bg-gray-400 text-white py-2 rounded-xl hover:bg-gray-50 font-bold text-sm transition-colors active:scale-[0.98] min-h-[44px]"
                  >
                    Отмена редактирования
                  </button>
                )}
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
                            {getVariants(product).map(v => (
                              <span
                                key={v.size || 'base'}
                                className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-bold"
                              >
                                {v.label ? `${v.label} — ` : ''}{fmtPrice(v.price)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="text-blue-500 hover:text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Редактировать"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onDeleteProduct(product.id)}
                          className="text-red-500 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium min-w-[44px] min-h-[44px] flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
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

        {activeTab === 'discounts' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-bold mb-4">Настройка скидок</h2>
              <p className="text-sm text-gray-600 mb-4">
                Укажите доступные скидки для контекстного меню (долгое нажатие на товар в корзине)
              </p>

              <DiscountEditor
                discounts={discounts}
                onUpdate={onUpdateDiscounts}
              />
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
