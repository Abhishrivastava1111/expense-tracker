// const { createClient } = require("redis");

// const redisClient = createClient({
//   url: `redis://${
//     process.env.REDIS_PASSWORD ? process.env.REDIS_PASSWORD + "@" : ""
//   }${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
// });
// console.log("consoleed here==================================", redisClient);

// redisClient.on("error", (err) => {
//   console.error("Redis Client Error", err);
// });

// const connectRedis = async () => {
//   try {
//     await redisClient.connect();
//     console.log("Redis client connected");
//     return redisClient;
//   } catch (error) {
//     console.error("Error connecting to Redis:", error);
//     process.exit(1);
//   }
// };

// module.exports = {
//   connectRedis,
//   redisClient,
// };


const { createClient } = require("redis");

const redisClient = createClient({
  url: `redis://${
    process.env.REDIS_PASSWORD ? process.env.REDIS_PASSWORD + "@" : ""
  }${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

let isConnected = false;

redisClient.on("error", (err) => {
  console.error("Redis Client Error", err);
  isConnected = false; // Mark as disconnected on error
});

redisClient.on("reconnecting", () => {
  console.log("Redis client reconnecting...");
});

redisClient.on("ready", () => {
  isConnected = true;
  console.log("Redis client connected");
});

redisClient.on("end", () => {
  isConnected = false;
  console.log("Redis client disconnected");
});

const connectRedis = async () => {
  if (isConnected) return redisClient;
  try {
    await redisClient.connect();
    isConnected = true;
    console.log("Redis client connected");
    return redisClient;
  } catch (error) {
    console.error("Error connecting to Redis:", error);
    throw error; // Let the caller handle the error
  }
};

const getRedisClient = async () => {
  if (!isConnected) {
    await connectRedis();
  }
  return redisClient;
};

// Graceful shutdown
process.on("SIGTERM", async () => {
  if (isConnected) {
    await redisClient.quit();
    console.log("Redis client closed");
  }
});

module.exports = {
  connectRedis,
  getRedisClient,
};