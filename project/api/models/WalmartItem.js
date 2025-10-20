// models/WalmartItem.js
const mongoose = require("mongoose");

const WalmartItemSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true },
  source: String,
  query: String,
  title: String,
  price: Number,
  currency: String,
  rating: Number,
  reviews: Number,
  seller: String,
  link: String,
  thumbnail: String,
  availability: String,
  brand: String,
  category: String,
  last_seen_at: String,
  created_at: String,
  raw: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

module.exports = mongoose.model("WalmartItem", WalmartItemSchema, "walmart_items");
