const { BusinessError } = require('./transaction');
const { toCents, toDecimal, MAX_TOTAL_CENTS } = require('./money');

const nextStatus = { pending: 'confirmed', paid: 'confirmed', confirmed: 'packing', packing: 'shipped', shipped: 'delivered' };
function couponCode(input) {
  if (typeof input !== 'string' || !/^[a-z0-9_-]{2,32}$/i.test(input.trim())) {
    throw new BusinessError(400, 'Mã giảm giá cần từ 2 đến 32 ký tự gồm chữ, số, gạch ngang hoặc gạch dưới.');
  }
  return input.trim().toUpperCase();
}
function amount(input, name, allowZero) {
  if (!['string','number'].includes(typeof input) || !/^\d{1,8}(?:\.\d{1,2})?$/.test(String(input))) {
    throw new BusinessError(400, name + ' không hợp lệ.');
  }
  const cents = toCents(input);
  if ((!allowZero && cents === 0n) || cents > MAX_TOTAL_CENTS) throw new BusinessError(400, name + ' ngoài giới hạn.');
  return toDecimal(cents);
}
function quote(coupon, subtotal) {
  if (!coupon || !coupon.active || coupon.expired || coupon.used_count >= coupon.use_limit) {
    throw new BusinessError(422, 'Mã giảm giá không còn hiệu lực hoặc đã hết lượt.');
  }
  if (subtotal === 0n || subtotal < toCents(coupon.minimum_total)) {
    throw new BusinessError(422, 'Giá trị giỏ hàng chưa đủ để sử dụng mã này.');
  }
  const value = toCents(coupon.amount);
  const discount = coupon.discount_type === 'percent'
    ? (subtotal * value + 5000n) / 10000n
    : value > subtotal ? subtotal : value;
  return { coupon_id: coupon.id, code: coupon.code, subtotal: toDecimal(subtotal),
    discount: toDecimal(discount), total: toDecimal(subtotal - discount) };
}
async function priceWithCoupon(connection, input, subtotal, lock = false) {
  const [rows] = await connection.query(
    'SELECT *, expires_at <= UTC_TIMESTAMP() AS expired FROM coupons WHERE code = ?' + (lock ? ' FOR UPDATE' : ''), [couponCode(input)]
  );
  return quote(rows[0], subtotal);
}
async function recordRedemption(connection, orderId, offer) {
  await connection.query('INSERT INTO order_discounts (order_id,coupon_id,subtotal,discount) VALUES (?,?,?,?)',
    [orderId, offer.coupon_id, offer.subtotal, offer.discount]);
  await connection.query('UPDATE coupons SET used_count=used_count+1 WHERE id=?', [offer.coupon_id]);
}
module.exports = { nextStatus, couponCode, amount, quote, priceWithCoupon, recordRedemption };
