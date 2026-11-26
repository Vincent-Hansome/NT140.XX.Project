async function notifyOrder(connection, userId, orderId, status) {
  await connection.query(
    "INSERT INTO customer_notifications (user_id,kind,entity_id,order_status) VALUES (?,'order',?,?)",
    [userId, orderId, status]
  );
}
async function notifySupport(connection, userId, ticketId) {
  await connection.query(
    "INSERT INTO customer_notifications (user_id,kind,entity_id) VALUES (?,'support',?)", [userId, ticketId]
  );
}
module.exports = { notifyOrder, notifySupport };
