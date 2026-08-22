import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import POSApp from './components/POSApp';

// Инициализация Electron IPC
if (typeof window !== 'undefined' && window.require) {
  try {
    const electronModule = window.require('electron');
    if (electronModule) {
      window.electron = { ipcRenderer: electronModule.ipcRenderer };
    }
  } catch (e) {
    console.log('Electron не доступен');
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<POSApp />);
