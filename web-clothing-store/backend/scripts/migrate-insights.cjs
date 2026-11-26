async function migrate(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS customer_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    kind ENUM('order','support') NOT NULL,
    entity_id INT NOT NULL,
    order_status VARCHAR(32),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_notifications_user (user_id, id),
    INDEX idx_notifications_unread (user_id, read_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
}
module.exports = { migrate };
