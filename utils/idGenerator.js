// utils/idGenerator.js
const pool = require('../config/db');

async function generateId(prefix, tableName, columnName) {
  const [[{ maxId }]] = await pool.query(
    `SELECT MAX(CAST(SUBSTRING(${columnName}, LENGTH(?) + 1) AS UNSIGNED)) AS maxId FROM ${tableName}`,
    [prefix]
  );
  const nextId = (maxId || 0) + 1;
  return `${prefix}${String(nextId).padStart(4, '0')}`;
}

module.exports = { generateId };
