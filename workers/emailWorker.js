require("dotenv").config();
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

const { connectRabbitMQ, consumeFromQueue } = require("../config/rabbitmq");
const { connectRedis } = require("../config/redis");
const { generateEmailSummary } = require("../services/analyticsService");

// Email templates
const getEmailTemplate = (data) => {
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

// Setup email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Process email queue
const processEmailQueue = async () => {
  try {
      await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");
    
    // Connect to Redis
    await connectRedis();

    // Connect to RabbitMQ
    const { channel } = await connectRabbitMQ();

    console.log("Email worker started and waiting for messages...");

    // Consume messages from the email queue
    await consumeFromQueue(process.env.RABBITMQ_EMAIL_QUEUE, async (data) => {
      try {
        console.log("Received email job:", data);

        if (data.type === "EXPENSE_SUMMARY_EMAIL") {
          const { userId, email, name, period, startDate, endDate } = data;

          // Generate email content
          const summaryData = await generateEmailSummary(
            userId,
            period,
            new Date(startDate),
            new Date(endDate)
          );

          // Generate HTML content
          const htmlContent = getEmailTemplate(summaryData);

          // Send email
          await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: `Expense Summary: ${
              period.charAt(0).toUpperCase() + period.slice(1)
            }`,
            html: htmlContent,
          });

          console.log(`Email sent to ${email}`);
        } else {
          console.log(`Unknown email job type: ${data.type}`);
        }
      } catch (error) {
        console.error("Error processing email job:", error);
      }
    });
  } catch (error) {
    console.error("Email worker error:", error);
    process.exit(1);
  }
};

// Start the worker
processEmailQueue();


