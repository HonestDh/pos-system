import React, { useState } from 'react';
import NumPad from './NumPad';

/**
 * Диалог PIN-кода для входа в админку.
 * mode = 'setup' — первый вход: задать PIN и подтвердить его.
 * mode = 'enter' — обычный вход: ввести существующий PIN.
 * Своя цифровая клавиатура — не зависим от системной экранной клавиатуры.
 */
const PinDialog = ({ mode, onSuccess, onCancel }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(mode === 'setup' ? 'create' : 'enter');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const current = step === 'confirm' ? confirmPin : pin;
  const setCurrent = step === 'confirm' ? setConfirmPin : setPin;

  const titles = {
    create: 'Задайте PIN администратора',
    confirm: 'Повторите PIN',
    enter: 'Введите PIN администратора'
  };

  const hints = {
    create: 'Четыре цифры. Понадобится при каждом входе в админку.',
    confirm: 'Введите те же четыре цифры ещё раз.',
    enter: 'Доступ к админке защищён PIN-кодом.'
  };

  const handleDigit = (digit) => {
    if (busy || current.length >= 4) return;
    setError('');
    const next = current + digit;
    setCurrent(next);
    if (next.length === 4) {
      // Небольшая задержка — чтобы пользователь увидел заполненную 4-ю точку
      setTimeout(() => submit(next), 150);
    }
  };

  const handleBackspace = () => {
    if (busy) return;
    setError('');
    setCurrent(current.slice(0, -1));
  };

  const handleClear = () => {
    if (busy) return;
    setError('');
    setCurrent('');
  };

  const submit = (value) => {
    if (!window.electron) {
      setError('Electron недоступен');
      return;
    }
    const ipc = window.electron.ipcRenderer;

    if (step === 'create') {
      setStep('confirm');
      return;
    }

    if (step === 'confirm') {
      if (value !== pin) {
        setError('PIN не совпадает — начните заново');
        setPin('');
        setConfirmPin('');
        setStep('create');
        return;
      }
      setBusy(true);
      ipc.invoke('set-pin', pin).then(res => {
        setBusy(false);
        if (res.ok) {
          onSuccess();
        } else {
          setError(res.error || 'Не удалось сохранить PIN');
          setPin('');
          setConfirmPin('');
          setStep('create');
        }
      });
      return;
    }

    // step === 'enter'
    setBusy(true);
    ipc.invoke('verify-pin', value).then(res => {
      setBusy(false);
      if (res.ok) {
        onSuccess();
      } else {
        setError('Неверный PIN');
        setPin('');
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">🔐</div>
          <h2 className="text-xl font-bold text-gray-900">{titles[step]}</h2>
          <p className="text-sm text-gray-500 mt-1">{hints[step]}</p>
        </div>

        {/* Индикатор введённых цифр */}
        <div className="flex justify-center gap-3 mb-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-colors ${
                current.length > i ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-center font-bold text-sm">
            {error}
          </div>
        )}

        {/* Цифровая клавиатура — общая с вводом сумм */}
        <NumPad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onClear={handleClear}
          bottomLeft="clear"
          disabled={busy}
        />

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

export default PinDialog;
