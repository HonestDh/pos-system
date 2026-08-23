// Работа с товарами и объёмами стакана

/** Допустимые объёмы стакана, мл */
export const VOLUME_OPTIONS = [100, 200, 250, 350, 400];

/** Подпись объёма для интерфейса и чека */
export function volumeLabel(ml) {
  return ml ? `${ml} мл` : '';
}

/**
 * Объёмы товара в едином виде: [{ ml, price, label }].
 * У товаров, созданных до появления объёмов, поля volumes нет —
 * для них возвращаем один безобъёмный вариант с базовой ценой,
 * чтобы старые товары продолжали работать.
 */
export function getVolumes(product) {
  const raw = product && Array.isArray(product.volumes) ? product.volumes : [];
  const list = raw
    .map(v => ({ ml: parseInt(v.ml, 10) || null, price: parseFloat(v.price) || 0 }))
    .filter(v => v.ml !== null)
    .sort((a, b) => a.ml - b.ml);

  if (list.length === 0) {
    return [{ ml: null, price: parseFloat(product && product.price) || 0, label: '' }];
  }
  return list.map(v => ({ ...v, label: volumeLabel(v.ml) }));
}

/** Нужно ли спрашивать объём при добавлении в корзину */
export function hasVolumeChoice(product) {
  return getVolumes(product).length > 1;
}

/** Минимальная цена — для показа «от N» на карточке */
export function minPrice(product) {
  const volumes = getVolumes(product);
  return volumes.reduce((min, v) => (v.price < min ? v.price : min), volumes[0].price);
}

/**
 * Ключ строки корзины. Один товар в разных объёмах — разные строки,
 * поэтому одного id недостаточно.
 */
export function lineId(productId, ml) {
  return `${productId}|${ml || ''}`;
}

/** Название с объёмом: «Латте 400 мл» */
export function withVolume(name, ml) {
  const label = volumeLabel(ml);
  return label ? `${name} ${label}` : String(name || '');
}
