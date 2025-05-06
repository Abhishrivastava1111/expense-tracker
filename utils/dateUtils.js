/**
 * Format date to YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
const formatDateToYYYYMMDD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Get first day of month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {Date} - First day of month
 */
const getFirstDayOfMonth = (year, month) => {
  return new Date(year, month - 1, 1);
};

/**
 * Get last day of month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {Date} - Last day of month
 */
const getLastDayOfMonth = (year, month) => {
  return new Date(year, month, 0);
};

/**
 * Get start and end dates for a period
 * @param {string} period - Period type (weekly, monthly, yearly, custom)
 * @param {Object} options - Options for custom period
 * @returns {Object} - Start and end dates
 */
const getDateRangeForPeriod = (period, options = {}) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case "weekly":
      // Last 7 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      endDate = now;
      break;

    case "monthly":
      // Last 30 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      endDate = now;
      break;

    case "yearly":
      // Last 365 days
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 365);
      endDate = now;
      break;

    case "custom":
      // Custom period
      if (options.startDate && options.endDate) {
        startDate = new Date(options.startDate);
        endDate = new Date(options.endDate);
      } else {
        throw new Error("Custom period requires startDate and endDate");
      }
      break;

    default:
      throw new Error("Invalid period type");
  }

  return { startDate, endDate };
};

/**
 * Get month name from month number
 * @param {number} month - Month number (1-12)
 * @returns {string} - Month name
 */
const getMonthName = (month) => {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return monthNames[month - 1];
};

/**
 * Get previous periods for comparison
 * @param {Date} currentStartDate - Current period start date
 * @param {Date} currentEndDate - Current period end date
 * @param {number} count - Number of previous periods to get
 * @returns {Array} - Array of previous periods
 */
const getPreviousPeriods = (currentStartDate, currentEndDate, count = 1) => {
  const periods = [];
  const periodLength = currentEndDate - currentStartDate;

  for (let i = 1; i <= count; i++) {
    const startDate = new Date(currentStartDate.getTime() - periodLength * i);
    const endDate = new Date(currentEndDate.getTime() - periodLength * i);

    periods.push({ startDate, endDate });
  }

  return periods;
};

module.exports = {
  formatDateToYYYYMMDD,
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getDateRangeForPeriod,
  getMonthName,
  getPreviousPeriods,
};
