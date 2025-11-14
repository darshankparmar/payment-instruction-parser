/**
 * Validator module for business rules
 * Validates parsed instructions against business rules and returns appropriate status codes
 */

const PaymentMessages = require('../../../messages/payment');

// Supported currencies
const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'GBP', 'GHS'];

/**
 * Validate that amount is a positive integer (no decimals, no negatives)
 * @param {number} amount - The amount to validate
 * @returns {Object|null} - Error object or null if valid
 */
function validateAmount(amount) {
  if (amount === null || amount === undefined) {
    return {
      isValid: false,
      errorCode: 'AM01',
      errorMessage: PaymentMessages.INVALID_AMOUNT,
    };
  }

  // Check if amount is a number
  if (typeof amount !== 'number' || Number.isNaN(amount)) {
    return {
      isValid: false,
      errorCode: 'AM01',
      errorMessage: PaymentMessages.INVALID_AMOUNT,
    };
  }

  // Check if amount is positive
  if (amount <= 0) {
    return {
      isValid: false,
      errorCode: 'AM01',
      errorMessage: PaymentMessages.INVALID_AMOUNT,
    };
  }

  // Check if amount is an integer (no decimals)
  if (!Number.isInteger(amount)) {
    return {
      isValid: false,
      errorCode: 'AM01',
      errorMessage: PaymentMessages.INVALID_AMOUNT,
    };
  }

  return null;
}

/**
 * Validate that currency is in supported list
 * @param {string} currency - The currency code to validate
 * @returns {Object|null} - Error object or null if valid
 */
function validateCurrency(currency) {
  if (!currency || typeof currency !== 'string') {
    return {
      isValid: false,
      errorCode: 'CU02',
      errorMessage: PaymentMessages.UNSUPPORTED_CURRENCY,
    };
  }

  const upperCurrency = currency.toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(upperCurrency)) {
    return {
      isValid: false,
      errorCode: 'CU02',
      errorMessage: PaymentMessages.UNSUPPORTED_CURRENCY,
    };
  }

  return null;
}

/**
 * Validate account ID format (letters, numbers, hyphens, periods, @ only)
 * @param {string} accountId - The account ID to validate
 * @returns {Object|null} - Error object or null if valid
 */
function validateAccountIdFormat(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    return {
      isValid: false,
      errorCode: 'AC04',
      errorMessage: PaymentMessages.INVALID_ACCOUNT_ID,
    };
  }

  // Check each character - only allow letters, numbers, hyphens, periods, and @
  for (let i = 0; i < accountId.length; i++) {
    const char = accountId[i];
    const isLetter = (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
    const isNumber = char >= '0' && char <= '9';
    const isAllowedSpecial = char === '-' || char === '.' || char === '@';

    if (!isLetter && !isNumber && !isAllowedSpecial) {
      return {
        isValid: false,
        errorCode: 'AC04',
        errorMessage: PaymentMessages.INVALID_ACCOUNT_ID,
      };
    }
  }

  return null;
}

/**
 * Find account by ID in accounts array
 * @param {Array} accounts - Array of account objects
 * @param {string} accountId - The account ID to find
 * @returns {Object|null} - Account object or null if not found
 */
function findAccount(accounts, accountId) {
  if (!accounts || !Array.isArray(accounts)) {
    return null;
  }

  for (let i = 0; i < accounts.length; i++) {
    if (accounts[i].id === accountId) {
      return accounts[i];
    }
  }

  return null;
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} dateStr - The date string to validate
 * @returns {Object|null} - Error object or null if valid
 */
function validateDateFormat(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return {
      isValid: false,
      errorCode: 'DT01',
      errorMessage: PaymentMessages.INVALID_DATE_FORMAT,
    };
  }

  // Check format: YYYY-MM-DD (10 characters)
  if (dateStr.length !== 10) {
    return {
      isValid: false,
      errorCode: 'DT01',
      errorMessage: PaymentMessages.INVALID_DATE_FORMAT,
    };
  }

  // Check for hyphens at correct positions
  if (dateStr[4] !== '-' || dateStr[7] !== '-') {
    return {
      isValid: false,
      errorCode: 'DT01',
      errorMessage: PaymentMessages.INVALID_DATE_FORMAT,
    };
  }

  // Extract year, month, day
  const yearStr = dateStr.substring(0, 4);
  const monthStr = dateStr.substring(5, 7);
  const dayStr = dateStr.substring(8, 10);

  // Check if all parts are numbers
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return {
      isValid: false,
      errorCode: 'DT01',
      errorMessage: PaymentMessages.INVALID_DATE_FORMAT,
    };
  }

  // Validate ranges
  if (year < 1000 || year > 9999) {
    return {
      isValid: false,
      errorCode: 'DT01',
      errorMessage: PaymentMessages.INVALID_DATE_FORMAT,
    };
  }

  if (month < 1 || month > 12) {
    return {
      isValid: false,
      errorCode: 'DT01',
      errorMessage: PaymentMessages.INVALID_DATE_FORMAT,
    };
  }

  if (day < 1 || day > 31) {
    return {
      isValid: false,
      errorCode: 'DT01',
      errorMessage: PaymentMessages.INVALID_DATE_FORMAT,
    };
  }

  return null;
}

/**
 * Main validation function
 * Validates parsed instruction against all business rules
 * @param {Object} parsed - Parsed instruction object
 * @param {Array} accounts - Array of account objects
 * @returns {Object} - Validation result with isValid, errorCode, errorMessage
 */
function validateTransaction(parsed, accounts) {
  // Validate amount
  const amountError = validateAmount(parsed.amount);
  if (amountError) {
    return amountError;
  }

  // Validate currency is supported
  const currencyError = validateCurrency(parsed.currency);
  if (currencyError) {
    return currencyError;
  }

  // Validate debit account ID format
  const debitIdError = validateAccountIdFormat(parsed.debitAccount);
  if (debitIdError) {
    return debitIdError;
  }

  // Validate credit account ID format
  const creditIdError = validateAccountIdFormat(parsed.creditAccount);
  if (creditIdError) {
    return creditIdError;
  }

  // Validate debit and credit accounts are different
  if (parsed.debitAccount === parsed.creditAccount) {
    return {
      isValid: false,
      errorCode: 'AC02',
      errorMessage: PaymentMessages.SAME_ACCOUNT_ERROR,
    };
  }

  // Find debit account
  const debitAccount = findAccount(accounts, parsed.debitAccount);
  if (!debitAccount) {
    return {
      isValid: false,
      errorCode: 'AC03',
      errorMessage: PaymentMessages.ACCOUNT_NOT_FOUND,
    };
  }

  // Find credit account
  const creditAccount = findAccount(accounts, parsed.creditAccount);
  if (!creditAccount) {
    return {
      isValid: false,
      errorCode: 'AC03',
      errorMessage: PaymentMessages.ACCOUNT_NOT_FOUND,
    };
  }

  // Validate both accounts have matching currencies
  const debitCurrency = debitAccount.currency.toUpperCase();
  const creditCurrency = creditAccount.currency.toUpperCase();
  const instructionCurrency = parsed.currency.toUpperCase();

  if (debitCurrency !== creditCurrency) {
    return {
      isValid: false,
      errorCode: 'CU01',
      errorMessage: PaymentMessages.CURRENCY_MISMATCH,
    };
  }

  // Validate instruction currency matches account currencies
  if (instructionCurrency !== debitCurrency) {
    return {
      isValid: false,
      errorCode: 'CU01',
      errorMessage: PaymentMessages.CURRENCY_MISMATCH,
    };
  }

  // Validate balance sufficiency
  if (debitAccount.balance < parsed.amount) {
    return {
      isValid: false,
      errorCode: 'AC01',
      errorMessage: PaymentMessages.INSUFFICIENT_FUNDS,
    };
  }

  // Validate date format if present
  if (parsed.executeBy) {
    const dateError = validateDateFormat(parsed.executeBy);
    if (dateError) {
      return dateError;
    }
  }

  // All validations passed
  return {
    isValid: true,
    errorCode: null,
    errorMessage: null,
  };
}

module.exports = {
  validateTransaction,
  validateAmount,
  validateCurrency,
  validateAccountIdFormat,
  validateDateFormat,
  findAccount,
};
