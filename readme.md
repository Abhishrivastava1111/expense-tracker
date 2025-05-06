# Expense Tracker App with Redis & RabbitMQ

A full-featured expense tracking application built with Node.js, Express, MongoDB, Redis, and RabbitMQ.

## Architecture Overview

- **Node.js/Express**: REST API server
- **MongoDB**: Persistent expense and user data
- **Redis**: Caching monthly summaries and user session data
- **RabbitMQ**: Asynchronous processing (email summaries, analytics)

## Core Features

### 1. User Authentication
- Sign-up/Login with JWT
- Session caching in Redis for quick auth checks

### 2. Expense Management
- Add expenses with category, amount, date, and notes
- View expenses with filtering by date range and category
- Data storage in MongoDB

### 3. Monthly Summary (Redis Cache)
- Calculate monthly totals per category
- Store in Redis for fast retrieval
- Automatic cache invalidation on expense changes

### 4. Dashboard Analytics
- Overall spending summary
- Category breakdown
- Monthly spending trends

### 5. Email Summary (RabbitMQ)
- Queue email jobs for weekly or custom reports
- Worker pulls from queue, compiles summary, sends email
- Status tracking in Redis

### 6. Spending Pattern Analysis (Async via RabbitMQ)
- Queue jobs to analyze past 3-6 months
- Worker computes trends (increasing/decreasing expenses)
- Results stored in Redis and displayed in frontend

## Prerequisites

- Node.js (v14+)
- MongoDB (v4+)
- Redis (v6+)
- RabbitMQ (v3+)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/expense-tracker.git
   cd expense-tracker
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the root directory based on the `.env.example` file
   - Update the variables with your configuration

## Running the Application

1. Start the API server:
   ```
   npm run dev
   ```

2. Start the workers (in separate terminals):
   ```
   npm run worker:email
   npm run worker:analytics
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/user` - Get current user info
- `POST /api/auth/logout` - Logout and invalidate token

### Expenses
- `GET /api/expenses` - Get all expenses (with optional filters)
- `GET /api/expenses/:id` - Get a specific expense
- `POST /api/expenses` - Create a new expense
- `PUT /api/expenses/:id` - Update an expense
- `DELETE /api/expenses/:id` - Delete an expense
- `GET /api/expenses/summary/monthly` - Get monthly expense summary

### Analytics
- `GET /api/analytics/summary` - Get overall spending summary
- `GET /api/analytics/patterns` - Get spending pattern analysis
- `GET /api/analytics/patterns/status` - Check analysis status
- `POST /api/analytics/email-summary` - Queue an email summary job

## Data Flow Example

1. User submits an expense via API
2. API saves it to MongoDB
3. API invalidates Redis cache for monthly summaries
4. API queues a RabbitMQ job for analytics recalculation
5. Worker processes the job and updates analytics in Redis
6. Updated data is available on next dashboard refresh

## Directory Structure

```
expense-tracker/
  ├── config/                  // Configuration files
  │   ├── db.js                // MongoDB connection
  │   ├── redis.js             // Redis connection
  │   └── rabbitmq.js          // RabbitMQ connection
  ├── models/                  // MongoDB models
  │   ├── User.js
  │   └── Expense.js
  ├── middleware/              // Express middleware
  │   ├── auth.js              // JWT authentication
  │   └── validate.js          // Request validation
  ├── routes/                  // API routes
  │   ├── auth.js              // Authentication routes
  │   ├── expenses.js          // Expense management routes
  │   └── analytics.js         // Dashboard and analytics routes
  ├── services/                // Business logic
  │   ├── expenseService.js    // Expense-related operations
  │   ├── cacheService.js      // Redis cache operations
  │   └── analyticsService.js  // Analysis operations
  ├── workers/                 // RabbitMQ workers
  │   ├── emailWorker.js       // Email summary worker
  │   └── analyticsWorker.js   // Spending pattern analysis worker
  ├── utils/                   // Utility functions
  │   ├── emailTemplates.js    // Email templates
  │   └── dateUtils.js         // Date manipulation helpers
  ├── app.js                   // Express app setup
  ├── server.js                // Server entry point
  ├── package.json             // Dependencies
  └── .env                     // Environment variables
```

## Error Handling

The application includes comprehensive error handling:

- Client-side validation with express-validator
- Server-side error handling middleware
- Redis and RabbitMQ connection error handling
- Worker process error handling

## Future Enhancements

- Recurring Expenses: Auto-generate and insert using cron + queue
- Budget Alerts: Notify via email or UI if limit crossed
- CSV Export: Generate reports asynchronously via RabbitMQ

## License

This project is licensed under the MIT License.