import React, { useState } from 'react';
import { fmtPrice } from '../utils/format';

const AdminPanel = ({ products, categories, onAddProduct, onDeleteProduct, onAddCategory, onDeleteCategory, allFolders }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [newProduct, setNewProduct] = useState({ name: '', price: '', image: '📦', selectedFolder: 'root' });
  const [newCategory, setNewCategory] = useState('');
  const [newCategoryFolder, setNewCategoryFolder] = useState('root');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojis = ['📦', '☕', '🍵', '🍊', '💧', '🍔', '🍕', '🥗', '🍝', '🍩', '🍰', '🍦', '🍟', '🍗', '🍎', '🍌', '🍇', '🍓', '🍒', '🍍'];

  // Получить categories-массив из selectedFolder
  const getProductCategories = () => {
    if (newProduct.selectedFolder === 'root') return [];
    return JSON.parse(newProduct.selectedFolder);
  };

  const handleAddProduct = () => {
    if (newProduct.name && newProduct.price) {
      onAddProduct({
        name: newProduct.name,
        categories: getProductCategories(),
        price: parseFloat(newProduct.price),
        image: newProduct.image
      });
      setNewProduct({ name: '', price: '', image: '📦', selectedFolder: 'root' });
      setShowEmojiPicker(false);
    }
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
                <input
                  type="number"
                  placeholder="Цена (Br)"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-base"
                />
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
                          <p className="text-sm text-gray-500">
                            {Array.isArray(product.categories) && product.categories.length > 0
                              ? `${product.categories.join(' / ')} • ${fmtPrice(product.price)}`
                              : `Корневая папка • ${fmtPrice(product.price)}`}
                          </p>
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
