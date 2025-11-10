// app.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// Amazon auth + SP-API routes
const amazonRoutes = require("./routes/amazonRoutes");
app.use("/", amazonRoutes); // All /auth and /spapi routes are defined inside amazonRoutes

// All commerce data scraping + deals stay grouped
const commerceRoutes = require("./routes/commerceRoutes");
app.use("/api/commerce", commerceRoutes);

// Debug tools
app.use("/api", require("./routes/dbDebug"));
app.use("/api", require("./routes/usersDebug"));

//User routes
const userRoutes = require("./routes/userRoutes"); // Importing user routes
app.use("/api/users", userRoutes); // Mounts them under /api/users

// Health check
app.get("/", (_req, res) => res.send("Backend running"));

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global Error:", err.stack);
  res.status(500).json({ error: "Server Error" });
});

const port = process.env.PORT || 8080;
connectDB().then(() => {
  app.listen(port, "0.0.0.0", () =>
    console.log(`Server live on ${port}`)
  );
});
