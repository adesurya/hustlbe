/**
 * Email utility functions
 */

/**
 * Normalize email address properly without removing dots
 * @param {string} email - Email address
 * @returns {string} Normalized email
 */
const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return email;
  }

  // Trim whitespace and convert to lowercase
  const trimmed = email.trim().toLowerCase();
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error('Invalid email format');
  }

  return trimmed;
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} Is valid email
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // More comprehensive email validation regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  return emailRegex.test(email.trim());
};

/**
 * Extract email domain
 * @param {string} email - Email address
 * @returns {string} Domain part of email
 */
const getEmailDomain = (email) => {
  if (!email || typeof email !== 'string') {
    return '';
  }

  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
};

/**
 * Check if email is from a common email provider
 * @param {string} email - Email address
 * @returns {boolean} Is from common provider
 */
const isCommonEmailProvider = (email) => {
  const domain = getEmailDomain(email);
  const commonProviders = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'live.com',
    'msn.com',
    'aol.com',
    'mail.com',
    'protonmail.com'
  ];

  return commonProviders.includes(domain);
};

/**
 * Mask email for privacy (show first 2 chars and domain)
 * @param {string} email - Email address
 * @returns {string} Masked email
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return email;
  }

  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart}***@${domain}`;
  }

  const masked = localPart.substring(0, 2) + '*'.repeat(Math.min(localPart.length - 2, 3));
  return `${masked}@${domain}`;
};

/**
 * Generate email verification subject
 * @param {string} appName - Application name
 * @returns {string} Email subject
 */
const getVerificationEmailSubject = (appName = 'App') => {
  return `Verify your email address - ${appName}`;
};

/**
 * Generate welcome email subject
 * @param {string} appName - Application name
 * @returns {string} Email subject
 */
const getWelcomeEmailSubject = (appName = 'App') => {
  return `Welcome to ${appName}!`;
};

module.exports = {
  normalizeEmail,
  isValidEmail,
  getEmailDomain,
  isCommonEmailProvider,
  maskEmail,
  getVerificationEmailSubject,
  getWelcomeEmailSubject
};