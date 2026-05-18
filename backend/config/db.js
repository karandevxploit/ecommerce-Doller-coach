const { connectMySQL, closeMySQL, getPool } = require("./mysql");

let isConnected = false;
let connectPromise = null;

const connectDB = async () => {
  if (isConnected) return getPool();
  if (connectPromise) return connectPromise;

  connectPromise = connectMySQL()
    .then((pool) => {
      isConnected = true;
      return pool;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

connectDB.getConnection = () => getPool();
connectDB.isConnected = () => isConnected;
connectDB.close = async () => {
  await closeMySQL();
  isConnected = false;
};

module.exports = connectDB;
