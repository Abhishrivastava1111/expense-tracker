const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "housing",
        "transportation",
        "food",
        "utilities",
        "healthcare",
        "entertainment",
        "personal",
        "education",
        "debt",
        "savings",
        "other",
      ],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringFrequency: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly", null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
ExpenseSchema.index({ user: 1, date: -1 });
ExpenseSchema.index({ user: 1, category: 1 });

module.exports = mongoose.model("Expense", ExpenseSchema);
