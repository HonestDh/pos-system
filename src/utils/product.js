// Работа с товарами и их размерами (объём стакана или масса порции)

/** Тип товара: продаётся по объёму (напитки) или по массе (десерты) */
export const UNIT_VOLUME = 'volume';
export const UNIT_WEIGHT = 'weight';

/** Предлагаемые объёмы стакана, мл. Свой объём кассир задаёт отдельным полем. */
export const VOLUME_OPTIONS = [100, 200, 250, 350, 400];

/** Тип товара; у товаров, созданных до появления десертов, поля нет — это объём */
export function productUnit(product) {
  return product && product.unit === UNIT_WEIGHT ? UNIT_WEIGHT : UNIT_VOLUME;
}

/**
 * Подпись размера: «400 мл» или «150 г».
 * Нулевой или незаданный размер подписи не имеет — такой товар
 * выводится одним названием и в интерфейсе, и в чеке.
 */
export function sizeLabel(size, unit) {
  const n = parseFloat(size);
  if (!n || n <= 0) return '';
  return unit === UNIT_WEIGHT ? `${n} г` : `${n} мл`;
}

/**
 * Размеры товара в едином виде: [{ size, unit, ml, g, price, label }].
 *
 * Список хранится в product.volumes — имя осталось от времён, когда были
 * только напитки; сейчас там же лежат и массы (поле g вместо ml).
 * У товаров, созданных до появления размеров, списка нет — для них
 * возвращаем один безразмерный вариант с базовой ценой.
 */
export function getVariants(product) {
  const unit = productUnit(product);
  const raw = product && Array.isArray(product.volumes) ? product.volumes : [];

  const list = raw
    .map(v => ({
      size: parseFloat(unit === UNIT_WEIGHT ? v.g : v.ml) || 0,
      price: parseFloat(v.price) || 0
    }))
    .filter(v => v.price > 0)
    .sort((a, b) => a.size - b.size);

  if (list.length === 0) {
    return [decorate({ size: 0, price: parseFloat(product && product.price) || 0 }, unit)];
  }
  return list.map(v => decorate(v, unit));
}

function decorate(v, unit) {
  return {
    size: v.size,
    unit,
    ml: unit === UNIT_VOLUME && v.size > 0 ? v.size : null,
    g: unit === UNIT_WEIGHT && v.size > 0 ? v.size : null,
    price: v.price,
    label: sizeLabel(v.size, unit)
  };
}

/** Нужно ли спрашивать размер при добавлении в корзину */
export function hasSizeChoice(product) {
  return getVariants(product).length > 1;
}

/** Минимальная цена — для показа «от N» на карточке */
export function minPrice(product) {
  const variants = getVariants(product);
  return variants.reduce((min, v) => (v.price < min ? v.price : min), variants[0].price);
}

/**
 * Ключ строки корзины. Один товар в разных размерах — разные строки,
 * поэтому одного id недостаточно.
 */
export function lineId(productId, variant) {
  const v = variant || {};
  return `${productId}|${v.unit || UNIT_VOLUME}|${v.size || ''}`;
}
