const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  validateRequest,
  expenseValidation,
} = require("../middleware/validate");
const Expense = require("../models/Expense");
const { getRedisClient } = require("../config/redis");
const { publishToQueue } = require("../config/rabbitmq");
const mongoose = require("mongoose");

// Helper function to invalidate Redis cache for monthly summaries
const invalidateMonthlyCache = async (userId) => {
  const redisClient = await getRedisClient();
  const keys = await redisClient.keys(`monthly_summary:${userId}:*`);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

// @route   POST api/expenses
// @desc    Create a new expense
// @access  Private
router.post("/", auth, expenseValidation, validateRequest, async (req, res) => {
  try {
    const { category, amount, date, note, isRecurring, recurringFrequency } =
      req.body;

    // Create new expense
    const newExpense = new Expense({
      user: req.user.id,
      category,
      amount,
      date: date || Date.now(),
      note,
      isRecurring: isRecurring || false,
      recurringFrequency: isRecurring ? recurringFrequency : null,
    });

    // Save expense to database
    const expense = await newExpense.save();

    // Invalidate Redis cache for monthly summaries
    await invalidateMonthlyCache(req.user.id);

    // Queue a job for analytics recalculation
    await publishToQueue(process.env.RABBITMQ_ANALYTICS_QUEUE, {
      type: "NEW_EXPENSE",
      userId: req.user.id,
      expenseId: expense._id,
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error("Create expense error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET api/expenses
// @desc    Get all expenses for a user
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const { start_date, end_date, category } = req.query;

    // Build query object
    const query = { user: req.user.id };

    // Add date range filter if provided
    if (start_date || end_date) {
      query.date = {};
      if (start_date) query.date.$gte = new Date(start_date);
      if (end_date) query.date.$lte = new Date(end_date);
    }

    // Add category filter if provided
    if (category) query.category = category;

    // Find expenses
    const expenses = await Expense.find(query).sort({ date: -1 });

    res.json(expenses);
  } catch (error) {
    console.error("Get expenses error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET api/expenses/:id
// @desc    Get a specific expense
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    // Check if expense exists
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Check if expense belongs to user
    if (expense.user.toString() !== req.user.id) {
      return res.status(401).json({ message: "User not authorized" });
    }

    res.json(expense);
  } catch (error) {
    console.error("Get expense error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   PUT api/expenses/:id
// @desc    Update an expense
// @access  Private
router.put(
  "/:id",
  auth,
  expenseValidation,
  validateRequest,
  async (req, res) => {
    try {
      const { category, amount, date, note, isRecurring, recurringFrequency } =
        req.body;

      // Find expense
      let expense = await Expense.findById(req.params.id);

      // Check if expense exists
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      // Check if expense belongs to user
      if (expense.user.toString() !== req.user.id) {
        return res.status(401).json({ message: "User not authorized" });
      }

      // Update expense
      expense.category = category;
      expense.amount = amount;
      expense.date = date || expense.date;
      expense.note = note;
      expense.isRecurring = isRecurring || false;
      expense.recurringFrequency = isRecurring ? recurringFrequency : null;

      // Save updated expense
      expense = await expense.save();

      // Invalidate Redis cache for monthly summaries
      await invalidateMonthlyCache(req.user.id);

      // Queue a job for analytics recalculation
      await publishToQueue(process.env.RABBITMQ_ANALYTICS_QUEUE, {
        type: "UPDATE_EXPENSE",
        userId: req.user.id,
        expenseId: expense._id,
      });

      res.json(expense);
    } catch (error) {
      console.error("Update expense error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   DELETE api/expenses/:id
// @desc    Delete an expense
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  try {
    // Find expense
    const expense = await Expense.findById(req.params.id);

    // Check if expense exists
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Check if expense belongs to user
    if (expense.user.toString() !== req.user.id) {
      return res.status(401).json({ message: "User not authorized" });
    }

    // Delete expense
    await expense.deleteOne();

    // Invalidate Redis cache for monthly summaries
    await invalidateMonthlyCache(req.user.id);

    // Queue a job for analytics recalculation
    await publishToQueue(process.env.RABBITMQ_ANALYTICS_QUEUE, {
      type: "DELETE_EXPENSE",
      userId: req.user.id,
    });

    res.json({ message: "Expense removed" });
  } catch (error) {
    console.error("Delete expense error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET api/expenses/monthly-summary
// @desc    Get monthly summary of expenses per category
// @access  Private
router.get("/summary/monthly", auth, async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "Month and year are required" });
    }

    const monthYear = `${year}-${month.padStart(2, "0")}`;
    const cacheKey = `monthly_summary:${req.user.id}:${monthYear}`;

    // Try to get data from Redis cache
    const redisClient = await getRedisClient();
    const cachedData = await redisClient.get(cacheKey);

    if (cachedData) {
      // Return cached data if it exists
      return res.json(JSON.parse(cachedData));
    }

    // If not in cache, calculate summary
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);

    const startDate = new Date(yearInt, monthInt - 1, 1);
    const endDate = new Date(yearInt, monthInt, 0); // Last day of the month
    endDate.setHours(23, 59, 59, 999);

    // Aggregate expenses by category for the specified month
    const summary = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.id),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { total: -1 },
      },
    ]);
    // Calculate total amount
    const totalAmount = summary.reduce((acc, curr) => acc + curr.total, 0);

    const result = {
      month,
      year,
      totalAmount,
      categories: summary.map((item) => ({
        category: item._id,
        total: item.total,
        count: item.count,
        percentage: (item.total / totalAmount) * 100,
      })),
    };

    // Store in Redis cache with TTL of 1 hour
    await redisClient.set(cacheKey, JSON.stringify(result), { EX: 3600 });

    res.json(result);
  } catch (error) {
    console.error("Monthly summary error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
