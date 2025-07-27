const { query } = require('express-validator');
const { handleValidationErrors } = require('./validation');

/**
 * Validate date query parameter for daily leaderboard
 */
const validateDateQuery = [
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be in YYYY-MM-DD format')
    .custom((value) => {
      if (value) {
        const date = new Date(value);
        const now = new Date();
        if (date > now) {
          throw new Error('Date cannot be in the future');
        }
        // Limit to reasonable past dates (e.g., 1 year ago)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (date < oneYearAgo) {
          throw new Error('Date cannot be more than 1 year ago');
        }
      }
      return true;
    }),
  handleValidationErrors
];

/**
 * Validate year and month query parameters for monthly leaderboard
 */
const validateMonthYearQuery = [
  query('year')
    .optional()
    .isInt({ min: 2020, max: new Date().getFullYear() })
    .withMessage(`Year must be between 2020 and ${new Date().getFullYear()}`),
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12')
    .custom((value, { req }) => {
      if (value && req.query.year) {
        const targetYear = parseInt(req.query.year);
        const targetMonth = parseInt(value);
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        // Check if the target date is not in the future
        if (targetYear === currentYear && targetMonth > currentMonth) {
          throw new Error('Cannot get leaderboard for future months');
        }
        if (targetYear > currentYear) {
          throw new Error('Cannot get leaderboard for future years');
        }
      }
      return true;
    }),
  handleValidationErrors
];

module.exports = {
  validateDateQuery,
  validateMonthYearQuery
};