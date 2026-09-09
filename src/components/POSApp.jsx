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
import UpdatePanel from './UpdatePanel';
import PinDialog from './PinDialog';
import VolumeDialog from './VolumeDialog';
import { roundPrice } from '../utils/format';
import { getVariants, hasSizeChoice, lineId } from '../utils/product';

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
  const [showUpdate, setShowUpdate] = useState(false);
  const [pinDialogMode, setPinDialogMode] = useState(null); // null | 'setup' | 'enter'
  const [volumeChoice, setVolumeChoice] = useState(null);   // товар, для которого выбирают объём
  const [categories, setCategories] = useState([]); // [{name, children:[...]}]
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [stats, setStats] = useState(null);
  const [printerConfig, setPrinterConfig] = useState({ enabled: false, printerName: '' });
  const [printError, setPrintError] = useState(null);
  const [orderNumber, setOrderNumber] = useState(null);
  const [saveError, setSaveError] = useState(null);
  // Есть ли готовое обновление — для метки в меню «Опции»
  const [updateReady, setUpdateReady] = useState(false);
  // Доступные скидки для контекстного меню
  const [discounts, setDiscounts] = useState([20, 50, 100]);

  // ----- Загрузка из Electron -----
  useEffect(() => {
    if (!window.electron) return;
    const ipc = window.electron.ipcRenderer;

    ipc.on('stats-updated', (event, data) => setStats(data));
    ipc.on('printer-config-loaded', (event, config) => setPrinterConfig(config));
    // Ошибка печати не должна проходить незаметно — показываем кассиру
    ipc.on('print-result', (event, result) => {
      if (result && !result.ok) {
        setPrintError(result.error || 'Чек не напечатан');
      }
    });
    // Номер заказа — кассиру называть клиенту
    ipc.on('order-number', (event, num) => setOrderNumber(num));
    // Продажа не легла на диск — это важнее ошибки печати
    ipc.on('save-error', (event, message) => setSaveError(message));
    // Метка в меню: обновление либо найдено, либо уже скачано
    ipc.on('updater-status', (event, s) => {
      setUpdateReady(!!s && (s.state === 'available' || s.state === 'downloaded'));
    });

    // Запрашиваем сами, а не ждём рассылки от main: слушатель здесь
    // появляется только после монтирования, и рассылка могла его опередить
    ipc.invoke('get-initial-data').then(data => {
      const cfg = (data && data.config) || {};
      if (Array.isArray(cfg.products) && cfg.products.length > 0) setProducts(cfg.products);
      if (Array.isArray(cfg.categories) && cfg.categories.length > 0) setCategories(cfg.categories);
      if (Array.isArray(cfg.discounts) && cfg.discounts.length > 0) setDiscounts(cfg.discounts);
      if (data && data.stats) setStats(data.stats);
      if (data && data.printerConfig) setPrinterConfig(data.printerConfig);
      setIsConfigLoaded(true);
    }).catch(error => {
      console.error('Не удалось загрузить настройки:', error);
      // Флаг не поднимаем: иначе пустое состояние затрёт файл на диске
    });
  }, []);

  // ----- Сохранение в Electron -----
  useEffect(() => {
    if (!isConfigLoaded || !window.electron) return;
    window.electron.ipcRenderer.send('save-config', { products, categories, discounts });
  }, [products, categories, discounts, isConfigLoaded]);

  // ----- Настройки / выход -----
  const closeAllPanels = () => {
    setShowAdmin(false);
    setShowStats(false);
    setShowPrinterSettings(false);
    setShowBackup(false);
    setShowExport(false);
    setShowUpdate(false);
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
    } else if (option === 'update') {
      const next = !showUpdate;
      closeAllPanels();
      setShowUpdate(next);
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
  // Строки различаются парой товар+размер: один товар в разных объёмах
  // (или массах) — это разные строки, поэтому ключ строки не id, а lineId
  const addToCart = (product, variant) => {
    const vol = variant || getVariants(product)[0];
    const key = lineId(product.id, vol);

    setCart(prev => {
      const existing = prev.find(item => item.lineId === key);
      if (existing) {
        return prev.map(item =>
          item.lineId === key ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, {
        lineId: key,
        id: product.id,
        name: product.name,
        image: product.image,
        categories: product.categories,
        unit: vol.unit,
        ml: vol.ml,
        g: vol.g,
        volumeLabel: vol.label,
        price: vol.price,
        quantity: 1
      }];
    });
  };

  // Нажатие на товар: если размеров несколько — сначала спросить какой
  const handleProductClick = (product) => {
    if (hasSizeChoice(product)) {
      setVolumeChoice(product);
    } else {
      addToCart(product);
    }
  };

  const removeFromCart = (key) => {
    setCart(prev => prev.filter(item => item.lineId !== key));
  };

  const updateQuantity = (key, delta) => {
    setCart(prev => prev.map(item => {
      if (item.lineId === key) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const applyDiscount = (key, discount) => {
    setCart(prev => prev.map(item => {
      if (item.lineId === key) {
        return { ...item, discount: discount };
      }
      return item;
    }));
  };

  const cartTotal = roundPrice(cart.reduce((sum, item) => {
    const finalPrice = item.discount > 0
      ? item.price * (1 - item.discount / 100)
      : item.price;
    return sum + finalPrice * item.quantity;
  }, 0));
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
          unit: item.unit,
          ml: item.ml,
          g: item.g,
          price: item.price,
          quantity: item.quantity,
          discount: item.discount || 0  // Добавляем информацию о скидке
        }))
      };
      window.electron.ipcRenderer.send('save-sale', sale);
    }
    setTimeout(() => {
      setCart([]);
      setAmountReceived('');
      setIsPaymentComplete(false);
      setOrderNumber(null);
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

  const handleUpdateProduct = (updatedProduct) => {
    setProducts(prev => prev.map(p =>
      p.id === updatedProduct.id ? updatedProduct : p
    ));
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

  const handleUpdateDiscounts = (newDiscounts) => {
    setDiscounts(newDiscounts);
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
            addToCart={handleProductClick}
            onCategoryClick={handleCategoryClick}
          />
        </div>

        <Cart
          cart={cart}
          removeFromCart={removeFromCart}
          updateQuantity={updateQuantity}
          applyDiscount={applyDiscount}
          cartTotal={cartTotal}
          discounts={discounts}
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
        showHome={categoryPath.length > 0 || showAdmin || showStats || showPrinterSettings || showBackup || showExport || showUpdate}
        onOptionsSelect={handleOptionsSelect}
        onExit={handleExit}
        updateReady={updateReady}
      />

      {showAdmin ? (
        <AdminPanel
          products={products}
          categories={categories}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          onDeleteProduct={handleDeleteProduct}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
          allFolders={allFolders}
          discounts={discounts}
          onUpdateDiscounts={handleUpdateDiscounts}
        />
      ) : showStats ? (
        <StatsPanel stats={stats} />
      ) : showPrinterSettings ? (
        <PrinterSettings config={printerConfig} onSave={handleSavePrinterConfig} />
      ) : showBackup ? (
        <BackupPanel />
      ) : showExport ? (
        <ExportPanel />
      ) : showUpdate ? (
        <UpdatePanel cartCount={cart.length} />
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

      {volumeChoice && (
        <VolumeDialog
          product={volumeChoice}
          onPick={(vol) => { addToCart(volumeChoice, vol); setVolumeChoice(null); }}
          onCancel={() => setVolumeChoice(null)}
        />
      )}

      {/* Номер заказа после оплаты — кассир называет его клиенту */}
      {orderNumber && (
        <div className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="bg-green-600 text-white rounded-3xl shadow-2xl px-12 py-8 text-center">
            <div className="text-lg font-bold opacity-90">Заказ принят</div>
            <div className="text-8xl font-bold leading-none my-2">№{orderNumber}</div>
          </div>
        </div>
      )}

      {saveError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4">
          <div className="bg-red-700 text-white rounded-xl shadow-xl p-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold">Продажа не сохранена</div>
              <div className="text-sm opacity-90 break-words">{saveError}</div>
            </div>
            <button
              onClick={() => setSaveError(null)}
              className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg bg-red-800 hover:bg-red-900 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
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
