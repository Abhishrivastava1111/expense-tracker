/**
 * Generate the HTML email template for expense summary
 * @param {Object} data - Email data
 * @returns {string} - HTML email content
 */
const expenseSummaryTemplate = (data) => {
  // Basic styling for email
  const styles = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
      h1 { color: #2c3e50; }
      h2 { color: #3498db; margin-top: 20px; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
      th { background-color: #f2f2f2; }
      .total { font-weight: bold; margin-top: 20px; }
      .footer { margin-top: 30px; font-size: 12px; color: #777; }
    </style>
  `;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Generate category breakdown table
  const categoryTable = data.categoryBreakdown
    .map(
      (cat) => `
    <tr>
      <td>${cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}</td>
      <td>${formatCurrency(cat.total)}</td>
      <td>${cat.count}</td>
      <td>${cat.percentage.toFixed(1)}%</td>
    </tr>
  `
    )
    .join("");

  // Generate recent expenses table (show only the most recent 10)
  const recentExpenses = data.expenses
    .slice(0, 10)
    .map(
      (exp) => `
    <tr>
      <td>${formatDate(exp.date)}</td>
      <td>${exp.category.charAt(0).toUpperCase() + exp.category.slice(1)}</td>
      <td>${formatCurrency(exp.amount)}</td>
      <td>${exp.note || "-"}</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Expense Summary</title>
      ${styles}
    </head>
    <body>
      <h1>Expense Summary</h1>
      <p>Hello ${data.userName},</p>
      <p>${data.message}</p>
      
      <div class="total">
        <h2>Total Spent: ${formatCurrency(data.totalSpent)}</h2>
        <p>Period: ${data.period} (${formatDate(data.startDate)} - ${formatDate(
    data.endDate
  )})</p>
      </div>
      
      <h2>Spending by Category</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Amount</th>
            <th>Count</th>
            <th>% of Total</th>
          </tr>
        </thead>
        <tbody>
          ${categoryTable}
        </tbody>
      </table>
      
      <h2>Recent Expenses</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          ${recentExpenses}
        </tbody>
      </table>
      
      <div class="footer">
        <p>This is an automated email from your Expense Tracker application.</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate the HTML email template for spending pattern analysis
 * @param {Object} data - Analysis data
 * @returns {string} - HTML email content
 */
const spendingPatternTemplate = (data) => {
  // Basic styling for email
  const styles = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
      h1 { color: #2c3e50; }
      h2 { color: #3498db; margin-top: 20px; }
      h3 { color: #2c3e50; margin-top: 15px; }
      p { margin-bottom: 10px; }
      ul { margin-bottom: 15px; }
      .insight { padding: 10px; margin: 10px 0; border-radius: 5px; }
      .insight.increasing { background-color: #fde0dc; border-left: 4px solid #e74c3c; }
      .insight.decreasing { background-color: #d1f5ea; border-left: 4px solid #2ecc71; }
      .insight.stable { background-color: #eaf2f8; border-left: 4px solid #3498db; }
      .footer { margin-top: 30px; font-size: 12px; color: #777; }
    </style>
  `;

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Generate insights HTML
  const insightsHtml = data.insights
    .map((insight) => {
      let className = "stable";
      if (insight.type === "increasing") className = "increasing";
      if (insight.type === "decreasing") className = "decreasing";

      return `
      <div class="insight ${className}">
        <p>${insight.message}</p>
      </div>
    `;
    })
    .join("");

  // Generate top categories HTML
  const topCategories = data.categoryTrends
    .filter((cat) => cat.averageMonthly > 0)
    .sort((a, b) => b.averageMonthly - a.averageMonthly)
    .slice(0, 5)
    .map(
      (cat) => `
      <li>
        <strong>${
          cat.category.charAt(0).toUpperCase() + cat.category.slice(1)
        }:</strong> 
        ${formatCurrency(cat.averageMonthly)}/month
        (${
          cat.trend === "increasing"
            ? "↑"
            : cat.trend === "decreasing"
            ? "↓"
            : "→"
        }
        ${Math.abs(cat.percentageChange).toFixed(1)}%)
      </li>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Spending Pattern Analysis</title>
      ${styles}
    </head>
    <body>
      <h1>Spending Pattern Analysis</h1>
      <p>Hello ${data.userName},</p>
      
      <p>Here's an analysis of your spending patterns over the past ${
        data.monthlyTotals.length
      } months:</p>
      
      <h2>Key Insights</h2>
      ${insightsHtml}
      
      <h2>Top Spending Categories</h2>
      <ul>
        ${topCategories}
      </ul>
      
      <h2>Overall Trend</h2>
      <p>
        Your overall spending is <strong>${data.overallTrend}</strong> with a 
        ${Math.abs(data.overallPercentageChange).toFixed(1)}% 
        ${data.overallPercentageChange >= 0 ? "increase" : "decrease"} 
        compared to the previous period.
      </p>
      
      <div class="footer">
        <p>This is an automated email from your Expense Tracker application.</p>
        <p>Analysis date: ${formatDate(data.analysisDate)}</p>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  expenseSummaryTemplate,
  spendingPatternTemplate,
};
