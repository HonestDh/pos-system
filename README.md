# 🛒 POS System

Modern Point of Sale (POS) system for Windows tablets, built with Electron, React, and Tailwind CSS.

## ✨ Features

- 📱 **User-friendly interface** — modern design based on Tailwind CSS
- 📦 **Product management** — add, edit, delete products with category support
- 📊 **Sales statistics** — reports by days, months, products, and payment methods
- 🖨️ **Automatic printing** — kitchen receipts via Windows Print Spooler
- 💰 **Multiple payment methods** — cash, card, separate billing
- 📈 **Export reports** — CSV files for Excel (summary, dynamics, products, receipts)
- 📧 **Report sending** — email distribution of reports to specified address
- 🔐 **PIN protection** — admin panel protected with 4-digit code
- 🔄 **Auto-updates** — updates via GitHub Releases
- 💾 **Backup system** — export/restore data

## 📋 Requirements

- Windows 10/11 (for tablet or PC)
- 4 GB RAM (minimum)
- 500 MB free space

## ⚙️ Installation

### Standard installation

1. Download the installer from [GitHub Releases](https://github.com/HonestDh/pos-system/releases)
2. Run `POS-Setup-*.exe`
3. Follow the installation instructions

### Manual installation (for developers)

```bash
# Clone the repository
git clone https://github.com/HonestDh/pos-system.git
cd pos-system

# Install dependencies
npm install

# Run in development mode
npm start
```

## 🎮 How to use

### Main screen

1. **Select category** — click on folder or product
2. **Add product to cart** — when clicking on product:
   - If product has one size — adds immediately
   - If multiple sizes — select required size
3. **Pay** — enter amount, select payment method, click "Pay"
4. **Receipt printing** — automatically prints to kitchen

### Admin panel (requires PIN)

1. Click "Options" → "Admin"
2. Enter PIN (default: 1234 if not changed)
3. Manage products and categories

### Statistics

1. Click "Options" → "Statistics"
2. View summary for all time
3. Click "More details" for month/day to see details

### Settings

- **Printer** — select printer and configure settings
- **Backup** — create data backup
- **Export** — download reports to CSV
- **Updates** — check for new versions

## 🛠️ Development

### Project structure

```
pos/
├── src/
│   ├── components/     # React components
│   │   ├── POSApp.jsx  # Main component
│   │   ├── AdminPanel.jsx
│   │   ├── ProductGrid.jsx
│   │   ├── Cart.jsx
│   │   ├── Payment.jsx
│   │   └── ...
│   ├── utils/          # Utilities
│   │   ├── format.js
│   │   └── product.js
│   └── index.jsx       # Entry point
├── main.js             # Electron main process
├── updater.js          # Auto-updates
├── package.json
└── webpack.config.js
```

### Commands

| Command | Description |
|---------|-------------|
| `npm start` | Run in development mode (Electron + Webpack) |
| `npm run dev` | Webpack dev server only |
| `npm run electron` | Electron only |
| `npm run build` | Production build |
| `npm run dist` | Create installer |
| `npm run pack` | Build without packaging |

### Technologies

- **Frontend**: React 18, Tailwind CSS, Webpack
- **Backend**: Electron 25, Node.js
- **Printing**: node-thermal-printer, Windows Print Spooler
- **Updates**: electron-updater

## ��� Security

- PIN code is stored encrypted in `userData`
- Sales data is saved atomically (file renaming)
- Corrupted files are moved to "quarantine"

## 📄 License

ISC

## 👥 Author

[HonestDh](https://github.com/HonestDh)
