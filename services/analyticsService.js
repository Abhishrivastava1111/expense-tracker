const Expense = require("../models/Expense");
const User = require("../models/User");
const {
  storeSpendingPatterns,
  markSpendingPatternsProcessing,
} = require("./cacheService");

/**
 * Generate overall spending summary for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Summary data
 */
const generateOverallSummary = async (userId) => {
  try {
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
    const formattedMonthlySpending = monthlySpending.map((item) => {
      return {
        month: monthNames[item._id.month - 1],
        year: item._id.year,
        total: item.total,
        label: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      };

     


     
    });

    return {
      totalSpent,
      categoryBreakdown: categoryBreakdown.map((item) => ({
        category: item._id,
        total: item.total,
        percentage: (item.total / totalSpent) * 100,
      })),
      monthlySpending: formattedMonthlySpending,
    };
  } catch (error) {
    console.error("Error generating overall summary:", error);
    throw error;
  }
};
      /**
       * Generate email summary content
       * @param {string} userId - User ID
       * @param {string} period - Period type (weekly, monthly, custom)
       * @param {Date} startDate - Start date
       * @param {Date} endDate - End date
       * @returns {Promise<Object>} - Email content data
       */
      const generateEmailSummary = async (
        userId,
        period,
        startDate,
        endDate
      ) => {
        try {
          // Get user info
          const user = await User.findById(userId);
          if (!user) {
            throw new Error("User not found");
          }

          // Get expenses for the period
          const expenses = await Expense.find({
            user: userId,
            date: { $gte: startDate, $lte: endDate },
          }).sort({ date: -1 });

          // If no expenses, return early
          if (expenses.length === 0) {
            return {
              userName: user.name,
              userEmail: user.email,
              period,
              startDate,
              endDate,
              totalSpent: 0,
              categoryBreakdown: [],
              expenses: [],
              message: "No expenses found for this period.",
            };
          }

          // Calculate total spent
          const totalSpent = expenses.reduce(
            (sum, expense) => sum + expense.amount,
            0
          );

          // Group by category
          const categoriesMap = {};
          expenses.forEach((expense) => {
            if (!categoriesMap[expense.category]) {
              categoriesMap[expense.category] = {
                category: expense.category,
                total: 0,
                count: 0,
              };
            }

            categoriesMap[expense.category].total += expense.amount;
            categoriesMap[expense.category].count += 1;
          });

          // Convert to array and calculate percentages
          const categoryBreakdown = Object.values(categoriesMap).map(
            (category) => ({
              ...category,
              percentage: (category.total / totalSpent) * 100,
            })
          );

          // Sort by total
          categoryBreakdown.sort((a, b) => b.total - a.total);

          return {
            userName: user.name,
            userEmail: user.email,
            period,
            startDate,
            endDate,
            totalSpent,
            categoryBreakdown,
            expenses,
            message: `Expense summary for ${period} period from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.`,
          };
        } catch (error) {
          console.error("Error generating email summary:", error);
          throw error;
        }
      };

 /**
       * Analyze spending patterns
       * @param {string} userId - User ID
       * @returns {Promise<Object>} - Analysis results
       */
      const analyzeSpendingPatterns = async (userId) => {
        try {
          // Mark analysis as processing
          await markSpendingPatternsProcessing(userId);

          // Get user info
          const user = await User.findById(userId);
          if (!user) {
            throw new Error("User not found");
          }

          // Calculate spending trends for the past 6 months
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

          // Get monthly spending by category
          const monthlyCategorySpending = await Expense.aggregate([
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
                  category: "$category",
                },
                total: { $sum: "$amount" },
              },
            },
            {
              $sort: {
                "_id.year": 1,
                "_id.month": 1,
              },
            },
          ]);

          // Structure the data by month and category
          const monthlyData = {};

          monthlyCategorySpending.forEach((item) => {
            const monthKey = `${item._id.year}-${item._id.month}`;
            if (!monthlyData[monthKey]) {
              monthlyData[monthKey] = {
                year: item._id.year,
                month: item._id.month,
                categories: {},
              };
            }

            monthlyData[monthKey].categories[item._id.category] = item.total;
          });

          // Convert to array and sort by date
          const sortedMonthlyData = Object.values(monthlyData).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
          });

          // Calculate month-over-month changes by category
          const categoryTrends = {};
          const allCategories = new Set();

          // First, collect all categories
          sortedMonthlyData.forEach((month) => {
            Object.keys(month.categories).forEach((category) => {
              allCategories.add(category);
            });
          });

          // Initialize category trends
          allCategories.forEach((category) => {
            categoryTrends[category] = {
              category,
              trend: "stable",
              percentageChange: 0,
              averageMonthly: 0,
              data: [],
            };
          });

          // Calculate trends for each category
          sortedMonthlyData.forEach((month) => {
            allCategories.forEach((category) => {
              const amount = month.categories[category] || 0;
              categoryTrends[category].data.push({
                year: month.year,
                month: month.month,
                amount,
              });
            });
          });

          // Calculate average and trends
          Object.values(categoryTrends).forEach((trend) => {
            if (trend.data.length < 2) {
              trend.trend = "insufficient data";
              trend.percentageChange = 0;
              trend.averageMonthly =
                trend.data.reduce((sum, month) => sum + month.amount, 0) /
                Math.max(1, trend.data.length);
              return;
            }

            // Calculate average monthly spending
            trend.averageMonthly =
              trend.data.reduce((sum, month) => sum + month.amount, 0) /
              trend.data.length;

            // Calculate percentage change (last 3 months vs previous 3 months)
            const recentMonths = trend.data.slice(-3);
            const previousMonths = trend.data.slice(-6, -3);

            if (previousMonths.length === 0) {
              trend.trend = "insufficient data";
              trend.percentageChange = 0;
              return;
            }

            const recentAvg =
              recentMonths.reduce((sum, month) => sum + month.amount, 0) /
              recentMonths.length;
            const previousAvg =
              previousMonths.reduce((sum, month) => sum + month.amount, 0) /
              previousMonths.length;

            if (previousAvg === 0) {
              if (recentAvg === 0) {
                trend.trend = "stable";
                trend.percentageChange = 0;
              } else {
                trend.trend = "increasing";
                trend.percentageChange = 100; // New spending
              }
            } else {
              trend.percentageChange =
                ((recentAvg - previousAvg) / previousAvg) * 100;

              // Determine trend
              if (trend.percentageChange > 10) {
                trend.trend = "increasing";
              } else if (trend.percentageChange < -10) {
                trend.trend = "decreasing";
              } else {
                trend.trend = "stable";
              }
            }
          });

          // Find highest increasing and decreasing categories
          const sortedByChange = Object.values(categoryTrends)
            .filter((trend) => trend.trend !== "insufficient data")
            .sort((a, b) => b.percentageChange - a.percentageChange);

          const increasingCategories = sortedByChange
            .filter((trend) => trend.trend === "increasing")
            .slice(0, 3);

          const decreasingCategories = sortedByChange
            .filter((trend) => trend.trend === "decreasing")
            .slice(0, 3);

          // Calculate overall spending trend
          const totalsByMonth = sortedMonthlyData.map((month) => {
            return {
              year: month.year,
              month: month.month,
              total: Object.values(month.categories).reduce(
                (sum, amount) => sum + amount,
                0
              ),
            };
          });

          let overallTrend = "stable";
          let overallPercentageChange = 0;

          if (totalsByMonth.length >= 2) {
            const recent = totalsByMonth.slice(-3);
            const previous = totalsByMonth.slice(-6, -3);

            if (previous.length > 0) {
              const recentAvg =
                recent.reduce((sum, month) => sum + month.total, 0) /
                recent.length;
              const previousAvg =
                previous.reduce((sum, month) => sum + month.total, 0) /
                previous.length;

              if (previousAvg > 0) {
                overallPercentageChange =
                  ((recentAvg - previousAvg) / previousAvg) * 100;

                if (overallPercentageChange > 10) {
                  overallTrend = "increasing";
                } else if (overallPercentageChange < -10) {
                  overallTrend = "decreasing";
                }
              }
            }
          }

          // Generate insights
          const insights = [];

          // Overall spending trend
          insights.push({
            type: "overall",
            message: `Your overall spending is ${overallTrend} with a ${Math.abs(
              overallPercentageChange
            ).toFixed(1)}% ${
              overallPercentageChange >= 0 ? "increase" : "decrease"
            } compared to the previous period.`,
          });

          // Top increasing categories
          if (increasingCategories.length > 0) {
            increasingCategories.forEach((category) => {
              insights.push({
                type: "increasing",
                category: category.category,
                message: `Your ${
                  category.category
                } spending has increased by ${Math.abs(
                  category.percentageChange
                ).toFixed(1)}% compared to the previous period.`,
              });
            });
          }

          // Top decreasing categories
          if (decreasingCategories.length > 0) {
            decreasingCategories.forEach((category) => {
              insights.push({
                type: "decreasing",
                category: category.category,
                message: `Your ${
                  category.category
                } spending has decreased by ${Math.abs(
                  category.percentageChange
                ).toFixed(1)}% compared to the previous period.`,
              });
            });
          }

          const result = {
            userId,
            userName: user.name,
            analysisDate: new Date(),
            overallTrend,
            overallPercentageChange,
            categoryTrends: Object.values(categoryTrends),
            monthlyTotals: totalsByMonth,
            insights,
            hasEnoughData: sortedMonthlyData.length >= 3,
          };

          // Store in Redis
          await storeSpendingPatterns(userId, result);

          return result;
        } catch (error) {
          console.error("Error analyzing spending patterns:", error);
          throw error;
        }
      };

       module.exports = {
         generateOverallSummary,
         analyzeSpendingPatterns,
         generateEmailSummary,
       };