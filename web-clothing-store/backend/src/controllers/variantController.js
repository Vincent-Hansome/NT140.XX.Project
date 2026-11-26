const db = require('../config/db');
const { BusinessError, withTransaction, sendTransactionError } = require('../utils/transaction');
const { sendDatabaseError } = require('../utils/databaseAvailability');
const { alternatives, options, variantRevision } = require('../utils/variants');
const MAX = 2147483647;

function normalized(value) {
  return (value || '').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('vi').trim();
}
function key(size,color) { return JSON.stringify([normalized(size),normalized(color)]); }

exports.list = async (req,res) => {
  try {
    const result = await withTransaction(async connection => {
      const [[product]] = await connection.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
      if (!product) throw new BusinessError(404,'Không tìm thấy sản phẩm.');
      const rows = await alternatives(connection,product.id);
      return {variants:options(product,rows),revision:variantRevision(product,rows)};
    });
    res.json(result);
  } catch(error) { if (!sendTransactionError(res,error)) sendDatabaseError(res,error); }
};

exports.save = async (req,res) => {
  const { revision, variants } = req.body || {};
  if (!Array.isArray(variants) || !variants.length || variants.length>100 || !variants.every(v=>v &&
      Number.isInteger(v.stock) && v.stock>=0 && v.stock<=MAX &&
      (v.id == null || (Number.isInteger(v.id) && v.id>=0 && v.id<=MAX)))) {
    return res.status(400).json({message:'Danh sách biến thể hoặc số lượng không hợp lệ.'});
  }
  try {
    await withTransaction(async connection => {
      const [[product]] = await connection.query('SELECT * FROM products WHERE id = ? FOR UPDATE',[req.params.id]);
      if (!product) throw new BusinessError(404,'Không tìm thấy sản phẩm.');
      const rows = await alternatives(connection, product.id, true);
      if (variantRevision(product,rows)!==revision) throw new BusinessError(409,'Tồn kho đã thay đổi. Mở lại bảng biến thể trước khi lưu.');
      const seen = new Set(), keep = new Set();
      let total = 0;
      for (const variant of variants) {
        total += variant.stock;
        if (total>MAX) throw new BusinessError(400,'Tổng tồn kho vượt giới hạn.');
        let size, color;
        if (variant.id != null) {
          if (keep.has(variant.id)) throw new BusinessError(400,'Biến thể bị lặp.');
          keep.add(variant.id);
          const old = variant.id===0 ? product : rows.find(row=>row.id===variant.id);
          if (!old) throw new BusinessError(409,'Biến thể đã thay đổi.');
          ({size,color}=old);
        } else {
          if (typeof variant.size !== 'string' || typeof variant.color !== 'string') throw new BusinessError(400,'Nhập đủ cỡ và màu.');
          size=variant.size.trim(); color=variant.color.trim();
          if (!size || !color || [...size].length>50 || [...color].length>50) throw new BusinessError(400,'Cỡ và màu cần từ 1 đến 50 ký tự.');
        }
        const identity=key(size,color);
        if (seen.has(identity)) throw new BusinessError(409,'Tổ hợp cỡ và màu bị trùng.');
        seen.add(identity);
      }
      if (!keep.has(0)) throw new BusinessError(400,'Cần giữ biến thể gốc.');
      for (const row of rows.filter(row=>!keep.has(row.id))) {
        const [[inCart]] = await connection.query('SELECT id FROM cart_items WHERE product_id=? AND variant_id=? LIMIT 1',[product.id,row.id]);
        if (inCart) throw new BusinessError(409,'Biến thể đang có trong giỏ hàng. Có thể đặt tồn kho về 0.');
        await connection.query('DELETE FROM product_variants WHERE id=? AND product_id=?',[row.id,product.id]);
      }
      for (const v of variants) {
        if (v.id === 0) continue;
        if (v.id == null) await connection.query('INSERT INTO product_variants (product_id,size,color,stock) VALUES (?,?,?,?)',[product.id,v.size.trim(),v.color.trim(),v.stock]);
        else await connection.query('UPDATE product_variants SET stock=? WHERE id=? AND product_id=?',[v.stock,v.id,product.id]);
      }
      await connection.query('UPDATE products SET stock=? WHERE id=?',[total,product.id]);
    });
    res.json({message:'Đã lưu biến thể.'});
  } catch(error) {
    if (error.code==='ER_DUP_ENTRY') return res.status(409).json({message:'Tổ hợp cỡ và màu bị trùng.'});
    if (!sendTransactionError(res,error)) sendDatabaseError(res,error);
  }
};
