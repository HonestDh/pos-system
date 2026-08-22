import React, { useState } from 'react';

const StatsPanel = ({ stats }) => {
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);

  if (!stats || !stats.sales) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-xl">
        Загрузка статистики...
      </div>
    );
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'BYN' }).format(amount);
  };

  const byMonth = {};
  stats.sales.forEach(sale => {
    const date = new Date(sale.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { count: 0, revenue: 0, sales: [] };
    }
    byMonth[monthKey].count += 1;
    byMonth[monthKey].revenue += sale.total;
    byMonth[monthKey].sales.push(sale);
  });

  const byDay = {};
  stats.sales.forEach(sale => {
    const date = new Date(sale.timestamp);
    const dayKey = date.toLocaleDateString('ru-RU');
    if (!byDay[dayKey]) {
      byDay[dayKey] = { count: 0, revenue: 0, sales: [] };
    }
    byDay[dayKey].count += 1;
    byDay[dayKey].revenue += sale.total;
    byDay[dayKey].sales.push(sale);
  });

  const totalStats = {
    count: stats.sales.length,
    revenue: stats.sales.reduce((sum, s) => sum + s.total, 0),
    avg: stats.sales.length > 0 ? stats.sales.reduce((sum, s) => sum + s.total, 0) / stats.sales.length : 0
  };

  const ReceiptCard = ({ sale }) => (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-500">
          {new Date(sale.timestamp).toLocaleTimeString('ru-RU')}
        </span>
        <span className="font-bold text-lg text-blue-600">{formatCurrency(sale.total)}</span>
      </div>
      <div className="text-sm text-gray-600 mb-2">
        Способ оплаты: {sale.paymentMethod === 'cash' ? 'Наличные' : sale.paymentMethod === 'card' ? 'Карта' : 'Сдельно'}
      </div>
      <div className="text-sm text-gray-600">
        {sale.items.map((item, i) => (
          <div key={i} className="flex justify-between py-1">
            <span>{item.name} × {item.quantity}</span>
            <span>{formatCurrency(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-gray-800">Статистика продаж</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm mb-5">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-xl font-bold">За всё время</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 p-5">
            <div className="text-center bg-blue-50 rounded-xl p-4">
              <div className="text-gray-500 text-sm mb-1 font-medium">Всего чеков</div>
              <div className="text-3xl font-bold text-blue-600">{totalStats.count}</div>
            </div>
            <div className="text-center bg-green-50 rounded-xl p-4">
              <div className="text-gray-500 text-sm mb-1 font-medium">Общая выручка</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalStats.revenue)}</div>
            </div>
            <div className="text-center bg-purple-50 rounded-xl p-4">
              <div className="text-gray-500 text-sm mb-1 font-medium">Средний чек</div>
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalStats.avg)}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm mb-5">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-xl font-bold">По месяцам</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, data]) => (
              <div key={month} className="p-4 flex items-center justify-between hover:bg-gray-50 gap-2">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">
                    📅
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800">
                      {new Date(month + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                    </div>
                    <div className="text-sm text-gray-500">{data.count} чеков</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-lg text-blue-600">{formatCurrency(data.revenue)}</div>
                  <button
                    onClick={() => setSelectedMonth(month)}
                    className="text-sm text-blue-600 hover:underline mt-1 px-2 py-1 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    Подробнее
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-xl font-bold">По дням</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])).map(([day, data]) => (
              <div key={day} className="p-4 flex items-center justify-between hover:bg-gray-50 gap-2">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-2xl flex-shrink-0">
                    📆
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-800">{day}</div>
                    <div className="text-sm text-gray-500">{data.count} чеков</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-lg text-green-600">{formatCurrency(data.revenue)}</div>
                  <button
                    onClick={() => setSelectedDay(day)}
                    className="text-sm text-green-600 hover:underline mt-1 px-2 py-1 rounded min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    Подробнее
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {(selectedDay || selectedMonth) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-bold">
                  {selectedDay ? `Чеки за ${selectedDay}` : `Чеки за ${new Date(selectedMonth + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`}
                </h2>
                <button
                  onClick={() => { setSelectedDay(null); setSelectedMonth(null); }}
                  className="text-gray-400 hover:text-gray-700 text-2xl w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                {selectedDay && byDay[selectedDay] && byDay[selectedDay].sales.length > 0 ? (
                  <div className="space-y-3">
                    {byDay[selectedDay].sales.map((sale, index) => (
                      <ReceiptCard key={index} sale={sale} />
                    ))}
                  </div>
                ) : selectedMonth && byMonth[selectedMonth] && byMonth[selectedMonth].sales.length > 0 ? (
                  <div className="space-y-3">
                    {byMonth[selectedMonth].sales.map((sale, index) => (
                      <ReceiptCard key={index} sale={sale} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    Нет чеков за выбранный период
                  </div>
                )}
              </div>
              <div className="p-5 border-t border-gray-200">
                <button
                  onClick={() => { setSelectedDay(null); setSelectedMonth(null); }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-lg min-h-[48px]"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsPanel;
