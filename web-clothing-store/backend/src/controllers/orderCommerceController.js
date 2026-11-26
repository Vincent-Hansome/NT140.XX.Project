const db = require('../config/db');
const { withTransaction, BusinessError, sendTransactionError } = require('../utils/transaction');
const { sendDatabaseError } = require('../utils/databaseAvailability');
const { logControllerError } = require('../utils/controllerLogger');
const { toCents, MAX_TOTAL_CENTS } = require('../utils/money');
const { amount, couponCode, nextStatus, priceWithCoupon } = require('../utils/orderCommerce');
const { isValidId } = require('../middlewares/idValidationMiddleware');

function endpoint(operation) {
  return async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await operation(req));
    } catch (error) {
      if (sendTransactionError(res, error)) return;
      logControllerError('orderCommerce', operation.name, error);
      sendDatabaseError(res, error);
    }
  };
}
function positiveInt(v) {
  return Number.isInteger(v) && v > 0 && v <= 2147483647;
}
function pageCursor(value) {
  if (value === undefined) return 2147483648;
  if (!isValidId(value)) throw new BusinessError(400, 'Vị trí trong danh sách không hợp lệ.');
  return Number(value);
}
exports.preview = endpoint(async function preview(req) {
  const [rows] = await db.query(`SELECT COALESCE(SUM(p.price * c.quantity),0) AS subtotal
    FROM cart_items c JOIN products p ON p.id=c.product_id WHERE c.user_id=?`, [req.user.id]);
  const subtotal = toCents(rows[0].subtotal);
  if (subtotal > MAX_TOTAL_CENTS) throw new BusinessError(422, 'Tổng tiền vượt giới hạn đặt hàng.');
  return priceWithCoupon(db, req.body?.code, subtotal);
});
exports.createCoupon = endpoint(async function createCoupon(req) {
  const body = req.body || {};
  const code = couponCode(body.code);
  const value = amount(body.amount, 'Mức giảm', false);
  const minimum = amount(body.minimum_total ?? 0, 'Giá trị đơn tối thiểu', true);
  if (!['fixed','percent'].includes(body.discount_type) ||
      (body.discount_type === 'percent' && toCents(value) > 10000n)) {
    throw new BusinessError(400, 'Phần trăm giảm phải lớn hơn 0 và tối đa 100%.');
  }
  if (!positiveInt(body.use_limit)) throw new BusinessError(400, 'Giới hạn lượt dùng phải là số nguyên dương.');
  const expires = body.expires_at;
  if (typeof expires !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(expires) ||
      !Number.isFinite(Date.parse(expires)) || Date.parse(expires) <= Date.now()) {
    throw new BusinessError(400, 'Hạn dùng phải là một thời điểm trong tương lai.');
  }
  try {
    const [result] = await db.query(`INSERT INTO coupons(code,discount_type,amount,minimum_total,expires_at,use_limit)
      VALUES (?,?,?,?,?,?)`, [code, body.discount_type, value, minimum, expires.slice(0,19).replace('T',' '), body.use_limit]);
    return { id: result.insertId, code };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new BusinessError(409, 'Mã này đã tồn tại.');
    throw error;
  }
});
exports.coupons = endpoint(async function coupons(req) {
  const [rows] = await db.query(`SELECT id,code,discount_type,amount,minimum_total,use_limit,used_count,active,
    DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%sZ') AS expires_at FROM coupons WHERE id<? ORDER BY id DESC LIMIT 51`, [pageCursor(req.query.before)]);
  const items = rows.slice(0,50);
  return {items, next: rows.length > 50 ? items.at(-1).id : null};
});
exports.setCouponActive = endpoint(async function setCouponActive(req) {
  if (typeof req.body?.active !== 'boolean') throw new BusinessError(400, 'Trạng thái mã không hợp lệ.');
  const [result] = await db.query('UPDATE coupons SET active=? WHERE id=?', [req.body.active, req.params.id]);
  if (!result.affectedRows) throw new BusinessError(404, 'Không tìm thấy mã.');
  return {active:req.body.active};
});
exports.activity = endpoint(async function activity(req) {
  const [orders] = await db.query('SELECT id,status,created_at FROM orders WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!orders.length) throw new BusinessError(404, 'Không tìm thấy đơn hàng.');
  const [events] = await db.query('SELECT status,created_at FROM order_status_events WHERE order_id=? ORDER BY id', [req.params.id]);
  const [returns] = await db.query(`SELECT r.id,r.order_item_id,r.kind,r.quantity,r.reason,r.status,r.created_at,r.decided_at
    FROM order_returns r JOIN order_items i ON i.id=r.order_item_id WHERE i.order_id=? ORDER BY r.id DESC`, [req.params.id]);
  const [discounts] = await db.query(`SELECT c.code,d.subtotal,d.discount FROM order_discounts d
    JOIN coupons c ON c.id=d.coupon_id WHERE d.order_id=?`, [req.params.id]);
  const timeline = [{status:'pending',created_at:orders[0].created_at}, ...events];
  if (!timeline.some(e => e.status === orders[0].status)) timeline.push({status:orders[0].status,created_at:null});
  return {timeline,returns,discount:discounts[0] || null};
});
exports.advance = endpoint(async function advance(req) {
  return withTransaction(async connection => {
    const [rows] = await connection.query('SELECT user_id,status FROM orders WHERE id=? FOR UPDATE', [req.params.id]);
    if (!rows.length) throw new BusinessError(404, 'Không tìm thấy đơn hàng.');
    const target = req.body?.status;
    if (typeof target !== 'string' || !Object.values(nextStatus).includes(target)) throw new BusinessError(400, 'Trạng thái đích không hợp lệ.');
    if (rows[0].status === target) return {status:target};
    if (nextStatus[rows[0].status] !== target) throw new BusinessError(409, 'Trạng thái đơn đã thay đổi. Hãy tải lại danh sách.');
    await connection.query('UPDATE orders SET status=? WHERE id=?', [target,req.params.id]);
    await connection.query('INSERT INTO order_status_events(order_id,status) VALUES (?,?)', [req.params.id,target]);
    await require('../utils/customerNotifications').notifyOrder(connection, rows[0].user_id, req.params.id, target);
    return {status:target};
  });
});
exports.requestReturn = endpoint(async function requestReturn(req) {
  const { item_id, quantity, kind, reason } = req.body || {};
  const key = req.get('Idempotency-Key');
  if (!positiveInt(item_id) || !positiveInt(quantity) || !['exchange','return'].includes(kind) ||
      typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000 ||
      typeof key !== 'string' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(key)) {
    throw new BusinessError(400, 'Kiểm tra mặt hàng, số lượng và lý do đổi trả.');
  }
  return withTransaction(async connection => {
    const [items] = await connection.query(`SELECT i.quantity,o.status FROM order_items i JOIN orders o ON o.id=i.order_id
      WHERE i.id=? AND o.id=? AND o.user_id=? FOR UPDATE`, [item_id,req.params.id,req.user.id]);
    if (!items.length) throw new BusinessError(404, 'Không tìm thấy mặt hàng trong đơn.');
    const [prior] = await connection.query('SELECT id FROM order_returns WHERE order_item_id=? AND request_key=?',[item_id,key]);
    if (prior.length) return {id:prior[0].id};
    if (items[0].status !== 'delivered') throw new BusinessError(409, 'Chỉ nhận đổi trả sau khi giao hàng thành công.');
    const [used] = await connection.query("SELECT COALESCE(SUM(quantity),0) AS qty FROM order_returns WHERE order_item_id=? AND status IN ('pending','approved')", [item_id]);
    if (quantity > Number(items[0].quantity) - Number(used[0].qty)) throw new BusinessError(409, 'Số lượng vượt quá số hàng còn có thể đổi trả.');
    const [result] = await connection.query('INSERT INTO order_returns(order_item_id,request_key,kind,quantity,reason) VALUES (?,?,?,?,?)',
      [item_id,key,kind,quantity,reason.trim()]);
    return {id:result.insertId};
  });
});
exports.listReturns = endpoint(async function listReturns(req) {
  const [rows] = await db.query(`SELECT r.*, o.id AS order_id,p.name, u.email FROM order_returns r
    JOIN order_items i ON i.id=r.order_item_id JOIN orders o ON o.id=i.order_id JOIN products p ON p.id=i.product_id
    JOIN users u ON u.id=o.user_id WHERE r.id<? ORDER BY r.id DESC LIMIT 51`, [pageCursor(req.query.before)]);
  const items = rows.slice(0,50);
  return {items,next:rows.length>50 ? items.at(-1).id : null};
});
exports.decideReturn = endpoint(async function decideReturn(req) {
  const status = req.body?.status;
  if (!['approved','rejected'].includes(status)) throw new BusinessError(400, 'Quyết định xử lý không hợp lệ.');
  return withTransaction(async connection => {
    const [rows] = await connection.query('SELECT status FROM order_returns WHERE id=? FOR UPDATE', [req.params.id]);
    if (!rows.length) throw new BusinessError(404, 'Không tìm thấy yêu cầu đổi trả.');
    if (rows[0].status === status) return {status};
    if (rows[0].status !== 'pending') throw new BusinessError(409, 'Yêu cầu đã được xử lý.');
    await connection.query('UPDATE order_returns SET status=?,decided_at=CURRENT_TIMESTAMP WHERE id=?', [status,req.params.id]);
    return {status};
  });
});
