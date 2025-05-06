const Expense = require("../models/Expense");
const {
  cacheMonthlyExpenseSummary,
  invalidateUserSummaries,
} = require("./cacheService");

/**
 * Create a new expense
 * @param {string} userId - User ID
 * @param {Object} expenseData - Expense data
 * @returns {Promise<Object>} - Created expense
 */
const createExpense = async (userId, expenseData) => {
  try {
    const newExpense = new Expense({
      user: userId,
      ...expenseData,
    });

    const expense = await newExpense.save();

    // Invalidate cached monthly summaries
    await invalidateUserSummaries(userId);

    return expense;
  } catch (error) {
    console.error("Error creating expense:", error);
    throw error;
  }
};

/**
 * Get expenses for a user with optional filters
 * @param {string} userId - User ID
 * @param {Object} filters - Optional filters (start_date, end_date, category)
 * @returns {Promise<Array>} - List of expenses
 */
const getExpenses = async (userId, filters = {}) => {
  try {
    const query = { user: userId };

    // Apply date range filter
    if (filters.start_date || filters.end_date) {
      query.date = {};
      if (filters.start_date) query.date.$gte = new Date(filters.start_date);
      if (filters.end_date) query.date.$lte = new Date(filters.end_date);
    }

    // Apply category filter
    if (filters.category) query.category = filters.category;

    return await Expense.find(query).sort({ date: -1 });
  } catch (error) {
    console.error("Error getting expenses:", error);
    throw error;
  }
};

/**
 * Get a specific expense
 * @param {string} userId - User ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Object|null>} - Expense or null if not found
 */
const getExpenseById = async (userId, expenseId) => {
  try {
    const expense = await Expense.findById(expenseId);

    // Check if expense exists and belongs to user
    if (!expense || expense.user.toString() !== userId) {
      return null;
    }

    return expense;
  } catch (error) {
    console.error("Error getting expense by ID:", error);
    throw error;
  }
};

/**
 * Update an expense
 * @param {string} userId - User ID
 * @param {string} expenseId - Expense ID
 * @param {Object} expenseData - Updated expense data
 * @returns {Promise<Object|null>} - Updated expense or null if not found
 */
const updateExpense = async (userId, expenseId, expenseData) => {
  try {
    // Find expense and check ownership
    const expense = await getExpenseById(userId, expenseId);

    if (!expense) {
      return null;
    }

    // Update fields
    Object.keys(expenseData).forEach((key) => {
      expense[key] = expenseData[key];
    });

    // Save updated expense
    const updatedExpense = await expense.save();

    // Invalidate cached monthly summaries
    await invalidateUserSummaries(userId);

    return updatedExpense;
  } catch (error) {
    console.error("Error updating expense:", error);
    throw error;
  }
};

/**
 * Delete an expense
 * @param {string} userId - User ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<boolean>} - Success status
 */
const deleteExpense = async (userId, expenseId) => {
  try {
    // Find expense and check ownership
    const expense = await getExpenseById(userId, expenseId);

    if (!expense) {
      return false;
    }

    // Delete expense
    await expense.deleteOne();

    // Invalidate cached monthly summaries
    await invalidateUserSummaries(userId);

    return true;
  } catch (error) {
    console.error("Error deleting expense:", error);
    throw error;
  }
};

/**
 * Get monthly expense summary
 * @param {string} userId - User ID
 * @param {string} month - Month (1-12)
 * @param {string} year - Year
 * @returns {Promise<Object>} - Monthly summary
 */
const getMonthlyExpenseSummary = async (userId, month, year) => {
  try {
    const startDate = new Date(`${year}-${month}-01`);
    const endDate = new Date(year, month, 0); // Last day of the month
    endDate.setHours(23, 59, 59, 999);

    // Aggregate expenses by category for the specified month
    const summary = await Expense.aggregate([
      {
        $match: {
          user: userId,
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

    // Cache the result
    await cacheMonthlyExpenseSummary(userId, month, year, result);

    return result;
  } catch (error) {
    console.error("Error getting monthly expense summary:", error);
    throw error;
  }
};

/**
 * Generate data for spending charts
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Chart data
 */
const generateChartData = async (userId) => {
  try {
    // Get total spending by category for pie chart
    const categoryData = await Expense.aggregate([
      { $match: { user: userId } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]);

    // Get monthly spending for last 6 months for bar chart
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyData = await Expense.aggregate([
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

    // Format monthly data for chart
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

    const formattedMonthlyData = monthlyData.map((item) => ({
      month: monthNames[item._id.month - 1],
      year: item._id.year,
      total: item.total,
      label: `${monthNames[item._id.month - 1]} ${item._id.year}`,
    }));

    return {
      pieChart: categoryData.map((item) => ({
        category: item._id,
        amount: item.total,
      })),
      barChart: formattedMonthlyData,
    };
  } catch (error) {
    console.error("Error generating chart data:", error);
    throw error;
  }
};

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getMonthlyExpenseSummary,
  generateChartData,
};
