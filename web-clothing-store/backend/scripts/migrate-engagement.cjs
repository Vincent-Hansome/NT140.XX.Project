async function migrate(db) {
  const [columns] = await db.query("SHOW COLUMNS FROM support_tickets LIKE 'order_id'");
  if (!columns.length) {
    await db.query('ALTER TABLE support_tickets ADD COLUMN order_id INT NULL, ADD FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL');
  }
  await db.query(`CREATE TABLE IF NOT EXISTS support_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    sender_role ENUM('customer','admin') NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    legacy_key VARCHAR(12) NULL,
    UNIQUE KEY uq_support_import (ticket_id, legacy_key),
    KEY idx_thread (ticket_id, id),
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  // The opening customer message already belongs to the ticket. Preserve legacy staff replies once.
  await db.query(`INSERT INTO support_messages (ticket_id, sender_role, body, created_at, legacy_key)
    SELECT t.id, 'admin', t.admin_reply, COALESCE(t.replied_at,t.updated_at,t.created_at), 'import'
    FROM support_tickets t WHERE t.admin_reply IS NOT NULL AND t.admin_reply <> ''
      AND NOT EXISTS (SELECT 1 FROM support_messages m WHERE m.ticket_id=t.id AND m.sender_role='admin')`);
  await db.query(`CREATE TABLE IF NOT EXISTS wishlist_items (
    user_id INT NOT NULL, product_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  await db.query(`CREATE TABLE IF NOT EXISTS product_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, product_id INT NOT NULL,
    rating TINYINT UNSIGNED NOT NULL, body VARCHAR(1500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_reviewer (product_id, user_id),
    KEY idx_product_reviews (product_id, id),
    CHECK (rating BETWEEN 1 AND 5),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}
module.exports = { migrate };

if (require.main === module) {
  require('dotenv').config({ path: require('node:path').join(__dirname,'../.env'), quiet: true });
  const db = require('../src/config/db');
  migrate(db).then(() => console.log('Engagement migration complete')).catch(error => {
    console.error('Engagement migration failed:', error.code || error.message);
    process.exitCode = 1;
  }).finally(() => db.end());
}
