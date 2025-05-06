const { validationResult, body } = require("express-validator");

// Middleware to check for validation errors
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// User registration validation rules
const registerValidation = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Please include a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];

// User login validation rules
const loginValidation = [
  body("email").isEmail().withMessage("Please include a valid email"),
  body("password").exists().withMessage("Password is required"),
];

// Expense validation rules
const expenseValidation = [
  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isIn([
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
    ])
    .withMessage("Invalid category"),
  body("amount")
    .isNumeric()
    .withMessage("Amount must be a number")
    .custom((value) => value > 0)
    .withMessage("Amount must be greater than 0"),
  body("date").optional().isISO8601().withMessage("Invalid date format"),
  body("isRecurring")
    .optional()
    .isBoolean()
    .withMessage("isRecurring must be a boolean"),
  body("recurringFrequency")
    .optional()
    .custom((value, { req }) => {
      if (req.body.isRecurring && !value) {
        throw new Error(
          "Recurring frequency is required for recurring expenses"
        );
      }
      if (
        value &&
        !["weekly", "monthly", "quarterly", "yearly"].includes(value)
      ) {
        throw new Error("Invalid recurring frequency");
      }
      return true;
    }),
];

module.exports = {
  validateRequest,
  registerValidation,
  loginValidation,
  expenseValidation,
};
