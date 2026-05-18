const connectDB = require("../config/db");
const { getPool } = require("../config/mysql");

beforeAll(async () => {
  await connectDB();
  await getPool().query("DELETE FROM mysql_documents");
});

afterAll(async () => {
  await connectDB.close();
});
