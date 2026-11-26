const router = require('express').Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');
const { validateIdParam, isValidId } = require('../middlewares/idValidationMiddleware');

router.use(['/notifications', '/reports/sales'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/notifications/unread', requireAuth, async (req, res) => {
  const [[row]] = await db.query('SELECT COUNT(*) AS unread FROM customer_notifications WHERE user_id=? AND read_at IS NULL', [req.user.id]);
  res.json(row);
});
router.get('/notifications', requireAuth, async (req, res) => {
  const before = req.query.before;
  if (before !== undefined && !isValidId(before)) return res.status(400).json({message: 'Mốc phân trang không hợp lệ.'});
  const [rows] = await db.query(
    `SELECT id,kind,entity_id,order_status,created_at,read_at FROM customer_notifications
     WHERE user_id=? ${before === undefined ? '' : 'AND id<?'} ORDER BY id DESC LIMIT 21`,
    before === undefined ? [req.user.id] : [req.user.id, Number(before)]
  );
  res.json({ items:rows.slice(0,20), nextCursor:rows.length>20 ? rows[19].id : null });
});
router.patch('/notifications/:id/read', requireAuth, validateIdParam, async (req,res) => {
  const [result] = await db.query(
    'UPDATE customer_notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND user_id=?',
    [req.params.id, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({message:'Không tìm thấy thông báo.'});
  res.json({read: true});
});

// Report boundaries are midnight in Viet Nam, independent of the database session time zone.
function startOfDay(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const utc = Date.parse(date+'T00:00:00Z');
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0,10) !== date) return NaN;
  return utc/1000 - 7*3600;
}
router.get('/reports/sales', requireAuth, requireAdmin, async (req,res) => {
  const start = startOfDay(req.query.from);
  const end = startOfDay(req.query.to) + 86400;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return res.status(400).json({message:'Khoảng ngày không hợp lệ.'});
  }
  const period = `FROM orders o JOIN order_status_events e ON e.order_id=o.id
                  WHERE o.status='delivered' AND e.status='delivered'
                  AND e.created_at >= FROM_UNIXTIME(?) AND e.created_at < FROM_UNIXTIME(?)`;
  const [[summary]] = await db.query('SELECT COUNT(*) AS orders, COALESCE(SUM(o.total),0) AS revenue '+period, [start,end]);
  const [products] = await db.query(`SELECT p.id,p.name,SUM(i.quantity) AS quantity
    FROM order_items i JOIN products p ON p.id=i.product_id
    WHERE i.order_id IN (SELECT o.id ${period})
    GROUP BY p.id,p.name ORDER BY quantity DESC,p.name LIMIT 10`,[start,end]);
  const [stock] = await db.query(`SELECT id,name,size,color,stock FROM (
    SELECT p.id,p.name,p.size,p.color,p.stock-COALESCE(s.stock,0) AS stock FROM products p
      LEFT JOIN (SELECT product_id,SUM(stock) AS stock FROM product_variants GROUP BY product_id) s ON s.product_id=p.id
    UNION ALL
    SELECT p.id,p.name,v.size,v.color,v.stock FROM product_variants v JOIN products p ON p.id=v.product_id
  ) inventory WHERE stock<=5 ORDER BY stock,name,size,color`);
  res.json({summary,products,stock});
});
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  require('../utils/controllerLogger').logControllerError('insights','request',error);
  return require('../utils/databaseAvailability').sendDatabaseError(res,error);
});
module.exports = router;
