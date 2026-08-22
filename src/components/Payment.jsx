import React, { useState } from 'react';
import { fmtPrice } from '../utils/format';
import AmountPad from './AmountPad';

const Payment = ({ cartTotal, paymentMode, setPaymentMode, amountReceived, setAmountReceived, change, onPayment, isPaymentComplete }) => {
  const paymentMethods = [
    { id: 'cash', label: 'Наличные', icon: '💵' },
    { id: 'card', label: 'Карта', icon: '💳' },
    { id: 'separately', label: 'Сдельно', icon: '🧾' }
  ];

  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');

  // Какое поле сейчас редактируется экранной клавиатурой
  const [padField, setPadField] = useState(null); // null | 'received' | 'cash' | 'card'

  const totalPaid = (parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0);
  const changeAmount = Math.max(0, totalPaid - cartTotal);

  const handlePayment = () => {
    if ((parseFloat(amountReceived) || 0) >= cartTotal) onPayment();
  };

  const handleSeparatePayment = () => {
    if (totalPaid >= cartTotal) onPayment();
  };

  const isDisabled = isPaymentComplete ||
    (paymentMode === 'separately'
      ? totalPaid < cartTotal
      : (parseFloat(amountReceived) || 0) < cartTotal);

  // Настройки клавиатуры для каждого поля
  const padConfig = {
    received: {
      title: 'Внесено',
      value: amountReceived,
      due: cartTotal,
      apply: setAmountReceived
    },
    cash: {
      title: 'Наличными',
      value: cashAmount,
      due: Math.max(0, cartTotal - (parseFloat(cardAmount) || 0)),
      apply: setCashAmount
    },
    card: {
      title: 'Картой',
      value: cardAmount,
      due: Math.max(0, cartTotal - (parseFloat(cashAmount) || 0)),
      apply: setCardAmount
    }
  };

  // Поле суммы: не <input>, а кнопка — клавиатуре Windows нечего вызывать,
  // ввод идёт только через экранный блок
  const AmountField = ({ label, value, onOpen }) => (
    <button
      onClick={onOpen}
      className="w-full text-left px-3 py-2 bg-white border-2 border-gray-300 rounded-xl hover:border-blue-400 active:scale-[0.99] min-h-[52px] flex items-center justify-between gap-2"
    >
      <span className="text-xs text-gray-500 font-medium shrink-0">{label}</span>
      <span className={`text-lg font-bold truncate ${value ? 'text-gray-900' : 'text-gray-300'}`}>
        {value ? fmtPrice(value) : '0,00 Br'}
      </span>
    </button>
  );

  return (
    <div className="bg-white border-t border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex gap-1.5">
          {paymentMethods.map(method => (
            <button
              key={method.id}
              onClick={() => setPaymentMode(method.id)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors font-semibold min-h-[38px] ${
                paymentMode === method.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="text-base">{method.icon}</span>
              <span className="text-xs">{method.label}</span>
            </button>
          ))}
        </div>

        <div className="text-right">
          <div className="text-xs text-gray-500 mb-0.5 font-medium">К оплате</div>
          <div className="text-xl font-bold text-blue-600">{fmtPrice(cartTotal)}</div>
        </div>
      </div>

      {paymentMode === 'separately' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <AmountField
              label="Наличными"
              value={cashAmount}
              onOpen={() => setPadField('cash')}
            />
            <AmountField
              label="Картой"
              value={cardAmount}
              onOpen={() => setPadField('card')}
            />
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Внесено:</span>
              <span className="font-bold">{fmtPrice(totalPaid)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Сдача:</span>
              <span className={`font-bold ${changeAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtPrice(changeAmount)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <AmountField
            label="Внесено"
            value={amountReceived}
            onOpen={() => setPadField('received')}
          />
          <div className="bg-gray-50 rounded-lg p-2.5 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Внесено:</span>
              <span className="font-bold">{fmtPrice(amountReceived || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 font-medium text-sm">Сдача:</span>
              <span className={`font-bold text-lg ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtPrice(change)}
              </span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={paymentMode === 'separately' ? handleSeparatePayment : handlePayment}
        disabled={isDisabled}
        className={`w-full mt-2 py-2.5 rounded-lg font-bold text-base transition-all active:scale-[0.98] min-h-[44px] ${
          isDisabled
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
        }`}
      >
        {isPaymentComplete ? '✓ Готово' : '💰 Оплатить'}
      </button>

      {padField && (
        <AmountPad
          title={padConfig[padField].title}
          initialValue={padConfig[padField].value}
          dueAmount={padConfig[padField].due}
          onConfirm={(v) => { padConfig[padField].apply(v); setPadField(null); }}
          onCancel={() => setPadField(null)}
        />
      )}
    </div>
  );
};

export default Payment;
