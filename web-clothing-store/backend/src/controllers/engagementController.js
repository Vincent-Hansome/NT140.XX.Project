const db = require('../config/db');
const { logControllerError } = require('../utils/controllerLogger');
const { sendDatabaseError } = require('../utils/databaseAvailability');
const { isObjectBody } = require('../utils/authValidation');
const { isValidId } = require('../middlewares/idValidationMiddleware');

function endpoint(name, handler) {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { return await handler(req, res); }
    catch (error) {
      logControllerError('engagementController', name, error);
      return sendDatabaseError(res, error);
    }
  };
}

exports.wishlist = endpoint('wishlist', async (req, res) => {
  const [rows] = await db.query(`SELECT p.id,p.name,p.price,p.stock,p.image_url FROM wishlist_items w
    JOIN products p ON p.id=w.product_id WHERE w.user_id=? ORDER BY w.created_at DESC, p.id DESC`, [req.user.id]);
  res.json(rows);
});
exports.save = endpoint('save', async (req, res) => {
  try {
    await db.query('INSERT INTO wishlist_items (user_id,product_id) VALUES (?,?)', [req.user.id, req.params.id]);
  } catch (error) {
    if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({message:'Không tìm thấy sản phẩm.'});
    if (error.code !== 'ER_DUP_ENTRY') throw error;
  }
  res.json({ saved: true });
});
exports.remove = endpoint('remove', async (req, res) => {
  await db.query('DELETE FROM wishlist_items WHERE user_id=? AND product_id=?', [req.user.id, req.params.id]);
  res.json({ saved: false });
});

const verifiedPurchase = `EXISTS (SELECT 1 FROM orders o JOIN order_items i ON i.order_id=o.id
  WHERE o.user_id=? AND i.product_id=? AND o.status='delivered')`;

exports.reviews = endpoint('reviews', async (req,res) => {
  const before = req.query.before;
  if (before !== undefined && !isValidId(before)) return res.status(400).json({message:'Mốc phân trang không hợp lệ.'});
  const [[summary]] = await db.query('SELECT COUNT(*) AS total, ROUND(AVG(rating),1) AS average FROM product_reviews WHERE product_id=?', [req.params.id]);
  const [rows] = await db.query(`SELECT r.id, r.rating, r.body, r.created_at, u.name AS author FROM product_reviews r
    JOIN users u ON u.id=r.user_id WHERE r.product_id=? ${before ? 'AND r.id < ?' : ''} ORDER BY r.id DESC LIMIT 21`,
    before ? [req.params.id, before] : [req.params.id]);
  res.json({ ...summary, reviews:rows.slice(0,20), nextCursor: rows.length>20 ? rows[19].id : null });
});
exports.eligibility = endpoint('eligibility', async (req,res) => {
  const args = [req.user.id,req.params.id];
  const [[row]] = await db.query(`SELECT ${verifiedPurchase} AS purchased, EXISTS (
    SELECT 1 FROM product_reviews WHERE user_id=? AND product_id=?) AS reviewed`, [...args,...args]);
  res.json({purchased:Boolean(row.purchased), reviewed:Boolean(row.reviewed)});
});
exports.review = endpoint('review', async (req,res) => {
  const input = req.body;
  if (!isObjectBody(input) || Object.keys(input).some(key => !['body','rating'].includes(key)) ||
      !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5 || typeof input.body !== 'string' ||
      !input.body.trim() || input.body.includes('\0') || Array.from(input.body.trim()).length>1500) {
    return res.status(400).json({message:'Chọn 1–5 sao và nhập nhận xét từ 1 đến 1.500 ký tự.'});
  }
  const args = [req.user.id,req.params.id];
  try {
    const [result] = await db.query(`INSERT INTO product_reviews(user_id,product_id,rating,body)
      SELECT ?,?,?,? FROM DUAL WHERE ${verifiedPurchase}`, [...args,input.rating,input.body.trim(),...args]);
    if (!result.affectedRows) return res.status(403).json({message:'Bạn có thể đánh giá sản phẩm sau khi nhận hàng.'});
    res.status(201).json({id:result.insertId});
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({message:'Bạn đã đánh giá sản phẩm này.'});
    throw error;
  }
});
