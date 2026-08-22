// Форматирование цены для отображения
// BYN формат: "1,50 Br" (два знака после запятой, точка заменена на запятую)
export function fmtPrice(value) {
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return '0,00 Br';
  const fixed = Math.round(num * 100) / 100;
  const str = fixed.toFixed(2).replace('.', ',');
  return str + ' Br';
}

/** Круглит число до 2 знаков после запятой (используется для вычислений) */
export function roundPrice(value) {
  return Math.round(parseFloat(value) * 100) / 100;
}
