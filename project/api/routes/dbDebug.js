const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

router.get("/db/debug", async (_req, res) => {
  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  const cols = (await db.listCollections().toArray()).map(c => c.name);
  res.json({ node_db_name: dbName, collections: cols });
});

module.exports = router;