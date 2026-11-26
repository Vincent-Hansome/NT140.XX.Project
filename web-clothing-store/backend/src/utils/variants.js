const { BusinessError } = require('./transaction');
const { createHash } = require('node:crypto');
const { productRevision } = require('./productRevision');

async function alternatives(db, id, locking = false) {
  const [rows] = await db.query(
    'SELECT id, product_id, size, color, stock FROM product_variants WHERE product_id = ? ORDER BY id' + (locking ? ' FOR UPDATE' : ''), [id]);
  return rows;
}
function options(product, rows) {
  const stock = product.stock - rows.reduce((sum, row) => sum + row.stock, 0);
  return [{id:0,product_id:product.id,size:product.size,color:product.color,stock}, ...rows];
}
function selection(product, rows, variantId) {
  const variant = options(product, rows).find(row => row.id === (variantId || 0));
  if (!variant) throw new BusinessError(409, 'Biến thể này không còn bán.');
  return variant;
}
function variantRevision(product, rows) {
  return createHash('sha256').update(JSON.stringify([productRevision(product), rows.map(row=>[row.id,row.size,row.color,row.stock])])).digest('hex');
}
module.exports = { alternatives, options, selection, variantRevision };
