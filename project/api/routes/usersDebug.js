// routes/usersDebug.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.models.__DbgUser || mongoose.model("__DbgUser", UserSchema, "users");

router.get("/users/debug", async (_req, res) => {
  const dbName = mongoose.connection.db?.databaseName;
  const count = await User.countDocuments();
  const sample = await User.findOne({}, { _id: 0, username: 1, email: 1 }).lean();
  res.json({ node_db_name: dbName, users_count: count, sample });
});

router.get("/users/exists", async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: "username required" });
  const exists = !!(await User.findOne({ username }).lean());
  res.json({ username, exists });
});

module.exports = router;
