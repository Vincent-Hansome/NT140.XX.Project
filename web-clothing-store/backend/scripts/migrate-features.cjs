// Hold a single named lock across schema changes and any resumable backfills.
async function migrate(connection) {
  const [[lock]] = await connection.query("SELECT GET_LOCK(CONCAT('moc-features-', LEFT(SHA2(DATABASE(),256),32)), 2) AS acquired");
  if (Number(lock.acquired) !== 1) throw new Error('Another feature migration is running');
  try {
    for (const name of ['support', 'insights', 'variants', 'commerce', 'engagement']) {
      await require('./migrate-' + name + '.cjs').migrate(connection);
    }
  } finally {
    await connection.query("SELECT RELEASE_LOCK(CONCAT('moc-features-', LEFT(SHA2(DATABASE(),256),32)))");
  }
}
if (require.main === module) {
  require('dotenv').config({quiet:true});
  const mysql = require('mysql2/promise');
  (async () => {
    const connection = await mysql.createConnection({host:process.env.DB_HOST, port:Number(process.env.DB_PORT||3306),
      user:process.env.DB_USER, password:process.env.DB_PASSWORD, database:process.env.DB_NAME});
    try { await migrate(connection); console.log('Store features ready'); } finally { await connection.end(); }
  })().catch(error => { console.error('Store migration failed:',error.code || error.message); process.exitCode=1; });
}
module.exports = {migrate};
