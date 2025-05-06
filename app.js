require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const mongoose = require("mongoose");
const { connectRedis } = require("./config/redis");
const { connectRabbitMQ } = require("./config/rabbitmq");

// Import routes
const authRoutes = require("./routes/auth");
const expenseRoutes = require("./routes/expenses");
const analyticsRoutes = require("./routes/analytics");

// Create Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Connect to Redis
connectRedis()
  .then(() => console.log("Redis connected"))
  .catch((err) => {
    console.error("Redis connection error:", err);
    process.exit(1);
  });

// Connect to RabbitMQ
connectRabbitMQ()
  .then(() => console.log("RabbitMQ connected"))
  .catch((err) => {
    console.error("RabbitMQ connection error:", err);
    process.exit(1);
  });

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "API is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    console.log("Redis connection established");

    // Start the server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

// Handle process termination
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});

module.exports = app;
