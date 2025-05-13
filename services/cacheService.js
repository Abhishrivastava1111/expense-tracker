const { getRedisClient } = require("../config/redis");

/**
 * Cache monthly expense summaries
 * @param {string} userId - User ID
 * @param {string} month - Month (1-12)
 * @param {string} year - Year
 * @param {Object} data - Summary data to cache
 * @param {number} ttl - Time to live in seconds (default: 1 hour)
 * @returns {Promise<boolean>} - Success status
 */
const cacheMonthlyExpenseSummary = async (
  userId,
  month,
  year,
  data,
  ttl = 3600
) => {
  try {
    const monthYear = `${year}-${month.padStart(2, "0")}`;
    const cacheKey = `monthly_summary:${userId}:${monthYear}`;

    const redisClient = await getRedisClient();
    await redisClient.set(cacheKey, JSON.stringify(data), { EX: ttl });

    return true;
  } catch (error) {
    console.error("Error caching monthly expense summary:", error);
    return false;
  }
};

/**
 * Get cached monthly expense summary
 * @param {string} userId - User ID
 * @param {string} month - Month (1-12)
 * @param {string} year - Year
 * @returns {Promise<Object|null>} - Cached data or null if not found
 */
const getMonthlyExpenseSummary = async (userId, month, year) => {
  try {
    const monthYear = `${year}-${month.padStart(2, "0")}`;
    const cacheKey = `monthly_summary:${userId}:${monthYear}`;
    const redisClient = await getRedisClient();
    const cachedData = await redisClient.get(cacheKey);

    if (!cachedData) {
      return null;
    }

    return JSON.parse(cachedData);
  } catch (error) {
    console.error("Error getting cached monthly expense summary:", error);
    return null;
  }
};

/**
 * Invalidate all monthly summaries for a user
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
const invalidateUserSummaries = async (userId) => {
  try {
    // Invalidate monthly summary cache
    const monthlyPattern = `monthly_summary:${userId}:*`;
    const redisClient = await getRedisClient();

    // Log the monthly summary keys being deleted
    const monthlyKeys = await redisClient.keys(monthlyPattern);
    console.log(
      `Found ${monthlyKeys.length} monthly summary keys to invalidate for user ${userId}:`,
      monthlyKeys
    );

    if (monthlyKeys.length > 0) {
      const deletedMonthlyCount = await redisClient.del(monthlyKeys);
      console.log(
        `Successfully deleted ${deletedMonthlyCount} monthly summary keys for user ${userId}`
      );
    }

    // Invalidate analytics summary cache
    const analyticsKey = `analytics_summary:${userId}`;
    const deletedAnalytics = await redisClient.del(analyticsKey);
    console.log(
      `Analytics summary cache invalidation for user ${userId}: ${
        deletedAnalytics ? "deleted" : "not found"
      }`
    );

    return true;
  } catch (error) {
    console.error("Error invalidating user summaries:", error);
    return false;
  }
};

/**
 * Store spending pattern analysis results
 * @param {string} userId - User ID
 * @param {Object} data - Analysis data
 * @param {number} ttl - Time to live in seconds (default: 1 day)
 * @returns {Promise<boolean>} - Success status
 */
const storeSpendingPatterns = async (userId, data, ttl = 86400) => {
  try {
    const cacheKey = `spending_patterns:${userId}`;
    const redisClient = await getRedisClient();
    await redisClient.set(cacheKey, JSON.stringify(data), { EX: ttl });

    // Also remove the processing flag

    await redisClient.del(`spending_patterns_processing:${userId}`);

    return true;
  } catch (error) {
    console.error("Error storing spending patterns:", error);
    return false;
  }
};

/**
 * Mark spending pattern analysis as processing
 * @param {string} userId - User ID
 * @param {number} ttl - Time to live in seconds (default: 5 minutes)
 * @returns {Promise<boolean>} - Success status
 */
const markSpendingPatternsProcessing = async (userId, ttl = 300) => {
  try {
    const processingKey = `spending_patterns_processing:${userId}`;
    const redisClient = await getRedisClient();
    await redisClient.set(processingKey, "true", { EX: ttl });

    return true;
  } catch (error) {
    console.error("Error marking spending patterns as processing:", error);
    return false;
  }
};

/**
 * Get spending pattern analysis
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - Analysis data or null if not found
 */
const getSpendingPatterns = async (userId) => {
  try {
    const cacheKey = `spending_patterns:${userId}`;
    const redisClient = await getRedisClient();
    const cachedData = await redisClient.get(cacheKey);

    if (!cachedData) {
      return null;
    }

    return JSON.parse(cachedData);
  } catch (error) {
    console.error("Error getting spending patterns:", error);
    return null;
  }
};

/**
 * Check if spending pattern analysis is processing
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether analysis is processing
 */
const isSpendingPatternsProcessing = async (userId) => {
  try {
    const processingKey = `spending_patterns_processing:${userId}`;
    const redisClient = await getRedisClient();
    const processing = await redisClient.get(processingKey);

    return !!processing;
  } catch (error) {
    console.error("Error checking if spending patterns is processing:", error);
    return false;
  }
};

module.exports = {
  cacheMonthlyExpenseSummary,
  getMonthlyExpenseSummary,
  invalidateUserSummaries,
  storeSpendingPatterns,
  markSpendingPatternsProcessing,
  getSpendingPatterns,
  isSpendingPatternsProcessing,
};
