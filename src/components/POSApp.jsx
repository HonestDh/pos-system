import React, { useState, useEffect } from 'react';
import ProductGrid from './ProductGrid';
import Cart from './Cart';
import Payment from './Payment';
import Header from './Header';
import AdminPanel from './AdminPanel';
import StatsPanel from './StatsPanel';
import PrinterSettings from './PrinterSettings';
import BackupPanel from './BackupPanel';
import ExportPanel from './ExportPanel';
import PinDialog from './PinDialog';
import { roundPrice } from '../utils/format';

// =============================================
// Утилиты для работы с деревом категорий
// =============================================

/** Добавить папку в дерево по полному пути родителя. */
const addFolderToTree = (tree, parentPath, folderName) => {
  if (parentPath.length === 0) {
    // Добавляем на корень
    if (tree.some(n => n.name === folderName)) return tree;
    return [...tree, { name: folderName, children: [] }];
  }

  const [first, ...rest] = parentPath;
  return tree.map(node => {
    const nm = node.name || '';
    if (nm === first) {
      if (rest.length === 0) {
        // Мы в родительской папке
        const children = node.children || [];
        if (children.some(c => c.name === folderName)) return node;
        return { ...node, children: [...children, { name: folderName, children: [] }] };
      }
      return { ...node, children: addFolderToTree(node.children || [], rest, folderName) };
    }
    if (node.children && node.children.length > 0) {
      return { ...node, children: addFolderToTree(node.children, parentPath, folderName) };
    }
    return node;
  });
};

/** Найти папку в дереве по полному пути, вернуть её children или []. */
const getFolderChildren = (tree, path) => {
  if (path.length === 0) return tree;
  const [first, ...rest] = path;
  for (const node of tree) {
    if ((node.name || '') === first) {
      return getFolderChildren(node.children || [], rest);
    }
  }
  return [];
};

/** Получить все папки в виде плоского списка с путём. */
const flattenFolders = (tree, prefix = []) => {
  const result = [];
  for (const node of tree) {
    const fullPath = [...prefix, node.name || ''];
    result.push({ name: fullPath.join(' / '), path: fullPath });
    if (node.children && node.children.length > 0) {
      result.push(...flattenFolders(node.children, fullPath));
    }
  }
  return result;
};

// =============================================
// Компонент
// =============================================

const POSApp = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [categoryPath, setCategoryPath] = useState([]); // [string, string, ...]
  const [paymentMode, setPaymentMode] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [isPaymentComplete, setIsPaymentComplete] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [pinDialogMode, setPinDialogMode] = useState(null); // null | 'setup' | 'enter'
  const [categories, setCategories] = useState([]); // [{name, children:[...]}]
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [stats, setStats] = useState(null);
  const [printerConfig, setPrinterConfig] = useState({ enabled: false, printerName: '' });
  const [printError, setPrintError] = useState(null);

  // ----- Загрузка из Electron -----
  useEffect(() => {
    if (window.electron) {
      window.electron.ipcRenderer.on('config-loaded', (event, data) => {
        if (data.config.products && data.config.products.length > 0) {
          setProducts(data.config.products);
        }
        if (data.config.categories && data.config.categories.length > 0) {
          setCategories(data.config.categories);
        }
        if (data.stats) setStats(data.stats);
        if (data.printerConfig) setPrinterConfig(data.printerConfig);
        setIsConfigLoaded(true);
      });
      window.electron.ipcRenderer.on('stats-updated', (event, data) => setStats(data));
      window.electron.ipcRenderer.on('printer-config-loaded', (event, config) => setPrinterConfig(config));
      // Ошибка печати не должна проходить незаметно — показываем кассиру
      window.electron.ipcRenderer.on('print-result', (event, result) => {
        if (result && !result.ok) {
          setPrintError(result.error || 'Чек не напечатан');
        }
      });
      window.electron.ipcRenderer.send('get-stats');
      window.electron.ipcRenderer.send('get-printer-config');
    }
  }, []);

  // ----- Сохранение в Electron -----
  useEffect(() => {
    if (!isConfigLoaded || !window.electron) return;
    window.electron.ipcRenderer.send('save-config', { products, categories });
  }, [products, categories]);

  // ----- Настройки / выход -----
  const closeAllPanels = () => {
    setShowAdmin(false);
    setShowStats(false);
    setShowPrinterSettings(false);
    setShowBackup(false);
    setShowExport(false);
  };

  // Открыть админку: сначала PIN. Если PIN ещё не задан — предложить создать.
  const requestAdmin = () => {
    if (showAdmin) {
      setShowAdmin(false);
      return;
    }
    if (!window.electron) {
      closeAllPanels();
      setShowAdmin(true);
      return;
    }
    window.electron.ipcRenderer.invoke('pin-exists').then(res => {
      setPinDialogMode(res.exists ? 'enter' : 'setup');
    });
  };

  const handlePinSuccess = () => {
    setPinDialogMode(null);
    closeAllPanels();
    setShowAdmin(true);
  };

  const handleOptionsSelect = (option) => {
    if (option === 'admin') {
      requestAdmin();
    } else if (option === 'stats') {
      const next = !showStats;
      closeAllPanels();
      setShowStats(next);
    } else if (option === 'printer') {
      const next = !showPrinterSettings;
      closeAllPanels();
      setShowPrinterSettings(next);
    } else if (option === 'backup') {
      const next = !showBackup;
      closeAllPanels();
      setShowBackup(next);
    } else if (option === 'export') {
      const next = !showExport;
      closeAllPanels();
      setShowExport(next);
    }
  };

  const handleExit = () => {
    if (window.electron) {
      window.electron.ipcRenderer.send('exit-app');
    } else {
      window.close();
    }
  };

  // ----- Получение данных для текущей папки -----
  const getCurrentData = () => {
    const depth = categoryPath.length;

    // Подпапки на текущем уровне
    const children = getFolderChildren(categories, categoryPath);
    const folders = children.map(c => ({
      name: c.name,
      children: Array.isArray(c.children) ? c.children : []
    }));

    // Добавляем подпапки из products, которых нет в структуре
    const existingNames = new Set(folders.map(f => f.name));
    products.forEach(product => {
      const cats = Array.isArray(product.categories) ? product.categories : [];
      if (cats.length <= depth + 1) return;
      // Проверяем, что путь совпадает с текущим
      if (!categoryPath.every((p, i) => p === cats[i])) return;
      const subName = cats[depth + 1];
      if (!existingNames.has(subName)) {
        folders.push({ name: subName, children: [] });
        existingNames.add(subName);
      }
    });

    // Товары на текущем уровне
    const productsHere = products.filter(product => {
      const cats = Array.isArray(product.categories) ? product.categories : [];
      if (cats.length !== depth) return false;
      return categoryPath.every((p, i) => p === cats[i]);
    });

    return { products: productsHere, folders };
  };

  const { products: currentProducts, folders: currentFolders } = getCurrentData();
  const filteredProducts = currentProducts;

  // ----- Корзина -----
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const cartTotal = roundPrice(cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const change = roundPrice(Math.max(0, parseFloat(amountReceived || 0) - cartTotal));

  // ----- Оплата -----
  const handlePayment = () => {
    setIsPaymentComplete(true);
    if (window.electron && cart.length > 0) {
      const sale = {
        timestamp: Date.now(),
        total: cartTotal,
        paymentMethod: paymentMode,
        amountReceived: parseFloat(amountReceived) || cartTotal,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          categories: item.categories,
          price: item.price,
          quantity: item.quantity
        }))
      };
      window.electron.ipcRenderer.send('save-sale', sale);
    }
    setTimeout(() => {
      setCart([]);
      setAmountReceived('');
      setIsPaymentComplete(false);
    }, 3000);
  };

  // ----- Товары -----
  const handleAddProduct = (newProduct) => {
    let cats = [];
    if (Array.isArray(newProduct.categories)) {
      cats = newProduct.categories.map(c =>
        typeof c === 'string' ? c : (c && c.name ? c.name : '')
      ).filter(Boolean);
    }
    setProducts(prev => [...prev, {
      ...newProduct,
      id: Date.now(),
      image: newProduct.image || '📦',
      categories: cats
    }]);
  };

  const handleDeleteProduct = (productId) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  // ----- Категории -----
  const handleAddCategory = (folderName, parentPath) => {
    setCategories(prev => addFolderToTree(prev, parentPath, folderName));
  };

  const handleDeleteCategory = (category) => {
    const removeRecursive = (nodes) => {
      return nodes
        .filter(n => n.name !== category.name)
        .map(n => ({
          ...n,
          children: n.children ? removeRecursive(n.children) : []
        }));
    };
    setCategories(prev => removeRecursive(prev));
    setProducts(prev => prev.filter(p => {
      const cats = Array.isArray(p.categories) ? p.categories : [];
      return !cats.includes(category.name);
    }));
  };

  // ----- Навигация -----
  const handleCategoryClick = (folderName) => {
    setCategoryPath(prev => [...prev, folderName]);
  };

  const handleNavigateTo = (path) => {
    setCategoryPath(path);
  };

  // «Главная» возвращает и из панелей (админка, статистика, принтер, бэкап),
  // и из вложенной папки товаров
  const handleGoHome = () => {
    closeAllPanels();
    setCategoryPath([]);
  };

  // ----- Список всех папок для админки -----
  const allFolders = flattenFolders(categories);

  // ----- Принтер -----
  const handleSavePrinterConfig = (config) => {
    setPrinterConfig(config);
    if (window.electron) {
      window.electron.ipcRenderer.send('save-printer-config', config);
    }
  };

  // ----- Main view -----
  const mainView = (
    <>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Путь по категориям — виден всегда, любой сегмент кликабелен.
              «Главная» здесь возвращает только в корень папок, не закрывая
              ничего лишнего (полный сброс — кнопка в шапке). */}
          <div className="px-4 py-2 overflow-x-auto bg-white border-b border-gray-200">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <button
                onClick={() => setCategoryPath([])}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors min-h-[36px] flex items-center gap-1.5 ${
                  categoryPath.length === 0
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                <span>🏠</span>
                <span>Главная</span>
              </button>
              {categoryPath.map((folder, index) => {
                const isLast = index === categoryPath.length - 1;
                return (
                  <React.Fragment key={index}>
                    <span className="text-gray-300">›</span>
                    <button
                      onClick={() => setCategoryPath(prev => prev.slice(0, index + 1))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors min-h-[36px] ${
                        isLast
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      {folder}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <ProductGrid
            products={filteredProducts}
            categories={currentFolders}
            addToCart={addToCart}
            onCategoryClick={handleCategoryClick}
          />
        </div>

        <Cart
          cart={cart}
          removeFromCart={removeFromCart}
          updateQuantity={updateQuantity}
          cartTotal={cartTotal}
        />
      </div>

      <Payment
        cartTotal={cartTotal}
        paymentMode={paymentMode}
        setPaymentMode={setPaymentMode}
        amountReceived={amountReceived}
        setAmountReceived={setAmountReceived}
        change={change}
        onPayment={handlePayment}
        isPaymentComplete={isPaymentComplete}
      />
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <Header
        onGoHome={handleGoHome}
        showHome={categoryPath.length > 0 || showAdmin || showStats || showPrinterSettings || showBackup || showExport}
        onOptionsSelect={handleOptionsSelect}
        onExit={handleExit}
      />

      {showAdmin ? (
        <AdminPanel
          products={products}
          categories={categories}
          onAddProduct={handleAddProduct}
          onDeleteProduct={handleDeleteProduct}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
          allFolders={allFolders}
        />
      ) : showStats ? (
        <StatsPanel stats={stats} />
      ) : showPrinterSettings ? (
        <PrinterSettings config={printerConfig} onSave={handleSavePrinterConfig} />
      ) : showBackup ? (
        <BackupPanel />
      ) : showExport ? (
        <ExportPanel />
      ) : (
        mainView
      )}

      {pinDialogMode && (
        <PinDialog
          mode={pinDialogMode}
          onSuccess={handlePinSuccess}
          onCancel={() => setPinDialogMode(null)}
        />
      )}

      {printError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4">
          <div className="bg-red-600 text-white rounded-xl shadow-xl p-4 flex items-center gap-3">
            <span className="text-2xl">🖨️</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold">Чек не напечатан</div>
              <div className="text-sm opacity-90 break-words">{printError}</div>
            </div>
            <button
              onClick={() => setPrintError(null)}
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg bg-red-700 hover:bg-red-800 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSApp;
