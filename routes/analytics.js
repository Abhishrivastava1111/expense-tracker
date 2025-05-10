const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getRedisClient } = require("../config/redis");
const { publishToQueue } = require("../config/rabbitmq");
const Expense = require("../models/Expense");

// @route   GET api/analytics/summary
// @desc    Get overall spending summary
// @access  Private
router.get("/summary", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `analytics_summary:${userId}`;

    // Try to get data from Redis cache
    const redisClient = await getRedisClient();
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      // Return cached data if it exists
      return res.json(JSON.parse(cachedData));
    }

    // If not in cache, calculate summary

    // Get total amount spent
    const totalResult = await Expense.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalSpent = totalResult.length > 0 ? totalResult[0].total : 0;

    // Get spending by category
    const categoryBreakdown = await Expense.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]);

    // Get spending by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlySpending = await Expense.aggregate([
      {
        $match: {
          user: userId,
          date: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Format monthly spending for easier frontend use
    const formattedMonthlySpending = monthlySpending.map((item) => {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return {
        month: monthNames[item._id.month - 1],
        year: item._id.year,
        total: item.total,
        label: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      };
    });

    const result = {
      totalSpent,
      categoryBreakdown: categoryBreakdown.map((item) => ({
        category: item._id,
        total: item.total,
        percentage: (item.total / totalSpent) * 100,
      })),
      monthlySpending: formattedMonthlySpending,
    };

    // Store in Redis cache with TTL of 1 hour
    await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 });

    res.json(result);
  } catch (error) {
    console.error("Analytics summary error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET api/analytics/patterns
// @desc    Get spending pattern analysis
// @access  Private
router.get("/patterns", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `spending_patterns:${userId}`;

    // Try to get data from Redis cache
    const redisClient = await getRedisClient();

    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      // Return cached data if it exists
      return res.json(JSON.parse(cachedData));
    }

    // If not in cache, queue a job to calculate patterns
    // and return a status message
    await publishToQueue(process.env.RABBITMQ_ANALYTICS_QUEUE, {
      type: "CALCULATE_PATTERNS",
      userId,
    });

    res.json({
      message: "Spending pattern analysis has been queued",
      status: "processing",
    });
  } catch (error) {
    console.error("Spending patterns error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET api/analytics/patterns/status
// @desc    Check the status of pattern analysis
// @access  Private
router.get("/patterns/status", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `spending_patterns:${userId}`;

    const redisClient = await getRedisClient();
    // Check if analysis exists in Redis
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      return res.json({
        status: "completed",
        data: JSON.parse(cachedData),
      });
    }

    // Check if analysis is in progress
    const processingKey = `spending_patterns_processing:${userId}`;
    const isProcessing = await redisClient.get(processingKey);

    if (isProcessing) {
      return res.json({
        status: "processing",
        message: "Analysis is in progress",
      });
    }

    // If not found and not processing, it was never requested
    res.json({
      status: "not_started",
      message: "Pattern analysis has not been requested",
    });
  } catch (error) {
    console.error("Pattern status error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST api/analytics/email-summary
// @desc    Queue an email summary job
// @access  Private
router.post("/email-summary", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period } = req.body;

    // Validate period
    if (!["weekly", "monthly", "custom"].includes(period)) {
      return res
        .status(400)
        .json({
          message: "Invalid period. Must be weekly, monthly, or custom",
        });
    }

    // Get date range based on period
    let startDate, endDate;
    const now = new Date();

    if (period === "weekly") {
      // Last 7 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      endDate = now;
    } else if (period === "monthly") {
      // Last 30 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      endDate = now;
    } else if (period === "custom") {
      // Custom period from request body
      const { startDateStr, endDateStr } = req.body;

      if (!startDateStr || !endDateStr) {
        return res
          .status(400)
          .json({ message: "Custom period requires startDate and endDate" });
      }

      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
    }

    // Queue email job with RabbitMQ
    await publishToQueue(process.env.RABBITMQ_EMAIL_QUEUE, {
      type: "EXPENSE_SUMMARY_EMAIL",
      userId,
      email: req.user.email,
      name: req.user.name,
      period,
      startDate,
      endDate,
    });

    res.json({
      message: "Email summary has been queued",
      status: "queued",
    });
  } catch (error) {
    console.error("Email summary request error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
