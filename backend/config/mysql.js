const mysql = require("mysql2/promise");
const { logger } = require("../utils/logger");

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mysqlConfig = Object.freeze({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: toNumber(process.env.MYSQL_PORT, 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "doller_coach",
  waitForConnections: true,
  connectionLimit: toNumber(process.env.MYSQL_CONNECTION_LIMIT, 10),
  queueLimit: 0,
  charset: "utf8mb4",
  timezone: "Z",
});

let pool;

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool(mysqlConfig);
  }

  return pool;
};

const connectMySQL = async () => {
  const db = getPool();
  const connection = await db.getConnection();

  try {
    await connection.ping();
    logger.info("[MYSQL_CONNECTED]", {
      host: mysqlConfig.host,
      port: mysqlConfig.port,
      database: mysqlConfig.database,
    });
  } finally {
    connection.release();
  }

  return db;
};

const closeMySQL = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

module.exports = {
  mysqlConfig,
  getPool,
  connectMySQL,
  closeMySQL,
};
