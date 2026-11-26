// Re-running preserves purchases, coupon counters and fulfillment history.
async function migrate(connection) {
  const [columns] = await connection.query("SHOW COLUMNS FROM orders LIKE 'status'");
  const statuses = ['pending', 'paid', 'shipped', 'cancelled', 'confirmed', 'packing', 'delivered'];
  const original = columns[0]?.Type || '';
  if (!statuses.every(status => original.includes("'" + status + "'"))) {
    if (!/^enum\((?:'[a-z_]+',)*'[a-z_]+'\)$/.test(original)) throw new Error('Unexpected orders.status definition');
    const missing = statuses.filter(status => !original.includes("'" + status + "'"));
    const extended = original.slice(0, -1) + missing.map(status => ",'" + status + "'").join('') + ')';
    await connection.query("ALTER TABLE orders MODIFY COLUMN status " + extended + " NOT NULL DEFAULT 'pending'");
  }
  await connection.query(`CREATE TABLE IF NOT EXISTS order_status_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL, status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_event_status(order_id, status),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(32) CHARACTER SET ascii NOT NULL UNIQUE,
    discount_type ENUM('percent','fixed') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    minimum_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    use_limit INT UNSIGNED NOT NULL,
    used_count INT UNSIGNED NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS order_discounts (
    order_id INT PRIMARY KEY, coupon_id INT NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL, discount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id)
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS order_returns (
    id INT AUTO_INCREMENT PRIMARY KEY, order_item_id INT NOT NULL,
    request_key CHAR(36) CHARACTER SET ascii NOT NULL,
    UNIQUE KEY uq_return_request(order_item_id,request_key),
    kind ENUM('exchange','return') NOT NULL,
    quantity INT UNSIGNED NOT NULL, reason VARCHAR(1000) NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP NULL,
    KEY idx_returns_status(status,id),
    FOREIGN KEY (order_item_id) REFERENCES order_items(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
module.exports = { migrate };
if (require.main === module) {
  const db = require('../src/config/db');
  migrate(db).then(() => console.log('Commerce migration complete'))
    .catch(err => { console.error('Commerce migration failed', err.code || err.message); process.exitCode = 1; })
    .finally(() => db.end());
}
