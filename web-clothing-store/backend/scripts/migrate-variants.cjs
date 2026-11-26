// Run after the baseline schema and catalog seed, on one mysql2 connection.
async function migrate(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL, size VARCHAR(50) NOT NULL, color VARCHAR(50) NOT NULL,
    stock INT NOT NULL CHECK(stock >= 0),
    UNIQUE KEY uq_variant_options (product_id, size, color),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  async function addColumn(table, name, definition) {
    const [rows] = await connection.query(
      'SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',
      [table, name]);
    if (!rows.length) await connection.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
  await addColumn('cart_items', 'variant_id', 'INT NOT NULL DEFAULT 0');
  await addColumn('order_items', 'variant_id', 'INT NULL');
  await addColumn('order_items', 'variant_size', 'VARCHAR(50) NULL');
  await addColumn('order_items', 'variant_color', 'VARCHAR(50) NULL');
  const [indices] = await connection.query('SHOW INDEX FROM cart_items');
  if (!indices.some(row => row.Key_name === 'uq_cart_variant')) {
    await connection.query('ALTER TABLE cart_items ADD UNIQUE KEY uq_cart_variant (user_id,product_id,variant_id)');
  }
  if (indices.some(row => row.Key_name === 'uq_cart_user_product')) {
    await connection.query('ALTER TABLE cart_items DROP INDEX uq_cart_user_product');
  }

  await connection.query(`CREATE TABLE IF NOT EXISTS catalog_seed_runs (
    seed_name VARCHAR(64) CHARACTER SET ascii PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await connection.beginTransaction();
  try {
    const [catalog] = await connection.query("SELECT id,size,color,stock,image_url FROM products WHERE image_url LIKE '/images/catalog/%' AND stock >= 4 AND color IS NOT NULL ORDER BY id FOR UPDATE");
    if (catalog.length) {
      const [run] = await connection.query("INSERT IGNORE INTO catalog_seed_runs (seed_name) VALUES ('moc-fashion-variants-v1')");
      if (run.affectedRows) {
        for (const product of catalog) {
          const sizes = ['S', 'M', 'L', 'XL'].includes(product.size) ? ['S', 'M', 'L', 'XL'] :
            (/^3[78]$|^4[01]$/.test(product.size) ? ['37','38','39','40','41'] :
              (['30','32'].includes(product.size) ? ['28','30','32','34'] : []));
          if (!sizes.length) continue;
          const [used] = await connection.query('SELECT 1 FROM cart_items WHERE product_id=? UNION ALL SELECT 1 FROM product_variants WHERE product_id=? LIMIT 1',[product.id,product.id]);
          if (used.length) continue;
          const combinations = sizes.filter(size => size !== product.size).map(size => [size,product.color]);
          if (/ao-thun-co-thuyen|ao-khoac-kaki|hoodie-xam-da/.test(product.image_url)) combinations.push([product.size,'Đen']);
          const stock = Math.floor(product.stock / (combinations.length + 1));
          for (const [size,color] of combinations) {
            await connection.query('INSERT INTO product_variants (product_id,size,color,stock) VALUES (?,?,?,?)',[product.id,size,color,stock]);
          }
        }
      }
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
}
module.exports = { migrate };

if (require.main === module) {
  const mysql = require('mysql2/promise');
  let connection;
  (async () => {
    connection = await mysql.createConnection({host:process.env.DB_HOST, port:process.env.DB_PORT || 3306,
      user:process.env.DB_USER, password:process.env.DB_PASSWORD, database:process.env.DB_NAME});
    await migrate(connection);
    console.log('Product variants ready');
  })().catch(error => { console.error(error.code || error.message); process.exitCode=1; })
    .finally(async()=>{ if(connection) await connection.end(); });
}
