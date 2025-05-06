require("dotenv").config();
const mongoose = require("mongoose");
const { connectRabbitMQ, consumeFromQueue } = require("../config/rabbitmq");
const { connectRedis } = require("../config/redis");
const { analyzeSpendingPatterns } = require("../services/analyticsService");
const {
  storeSpendingPatterns,
  invalidateUserSummaries,
} = require("../services/cacheService");

// Process analytics queue
const processAnalyticsQueue = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Connect to Redis
    await connectRedis();

    // Connect to RabbitMQ
    const { channel } = await connectRabbitMQ();

    console.log("Analytics worker started and waiting for messages...");

    // Consume messages from the analytics queue
    await consumeFromQueue(
      process.env.RABBITMQ_ANALYTICS_QUEUE,
      async (data) => {
        try {
          console.log("Received analytics job:", data);

          // Process different job types
          switch (data.type) {
            case "NEW_EXPENSE":
            case "UPDATE_EXPENSE":
            case "DELETE_EXPENSE":
              // Invalidate user's cached summaries
              await invalidateUserSummaries(data.userId);
              console.log(`Invalidated cache for user ${data.userId}`);
              break;

            case "CALCULATE_PATTERNS":
              // Analyze spending patterns and store results
              try {
                console.log(
                  `Calculating spending patterns for user ${data.userId}`
                );
                const patterns = await analyzeSpendingPatterns(data.userId);
                console.log(
                  `Successfully calculated patterns for user ${data.userId}`
                );
              } catch (error) {
                console.error(
                  `Error calculating patterns for user ${data.userId}:`,
                  error
                );
              }
              break;

            default:
              console.log(`Unknown analytics job type: ${data.type}`);
          }
        } catch (error) {
          console.error("Error processing analytics job:", error);
        }
      }
    );
  } catch (error) {
    console.error("Analytics worker error:", error);
    process.exit(1);
  }
};

// Start the worker
processAnalyticsQueue();

// Handle process termination
process.on("SIGINT", async () => {
  console.log("Shutting down analytics worker...");
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});
