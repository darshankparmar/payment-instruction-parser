/**
 * Executor module for transaction processing
 * Handles transaction execution logic including date comparison and balance updates
 */

const PaymentMessages = require('../../../messages/payment');

/**
 * Get current UTC date (date only, no time component)
 * @returns {Date} - Current date in UTC with time set to 00:00:00
 */
function getCurrentUTCDate() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

/**
 * Parse date string (YYYY-MM-DD) to UTC Date object
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} - Date object in UTC
 */
function parseUTCDate(dateStr) {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const day = parseInt(parts[2], 10);

  return new Date(Date.UTC(year, month, day));
}

/**
 * Determine if transaction should be executed immediately or marked as pending
 * @param {string|null} executeBy - Execute by date string (YYYY-MM-DD) or null
 * @returns {boolean} - True if should execute immediately, false if pending
 */
function shouldExecuteImmediately(executeBy) {
  // If no date specified, execute immediately
  if (!executeBy) {
    return true;
  }

  const today = getCurrentUTCDate();
  const instructionDate = parseUTCDate(executeBy);

  // Execute immediately if date is today or in the past
  return instructionDate <= today;
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
 * Execute transaction by updating account balances
 * @param {Object} parsed - Parsed instruction object
 * @param {Array} accounts - Array of account objects
 * @returns {Object} - Execution result with status, statusCode, statusReason, and accounts
 */
function executeTransaction(parsed, accounts) {
  const debitAccount = findAccount(accounts, parsed.debitAccount);
  const creditAccount = findAccount(accounts, parsed.creditAccount);

  // Check if transaction should be executed immediately or marked as pending
  const executeImmediately = shouldExecuteImmediately(parsed.executeBy);

  if (executeImmediately) {
    // Execute transaction immediately
    // Store original balances
    const debitBalanceBefore = debitAccount.balance;
    const creditBalanceBefore = creditAccount.balance;

    // Update balances
    const newDebitBalance = debitAccount.balance - parsed.amount;
    const newCreditBalance = creditAccount.balance + parsed.amount;

    // Build response accounts array preserving original order
    const responseAccounts = [];
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];

      if (account.id === parsed.debitAccount) {
        responseAccounts.push({
          id: account.id,
          balance: newDebitBalance,
          balance_before: debitBalanceBefore,
          currency: account.currency.toUpperCase(),
        });
      } else if (account.id === parsed.creditAccount) {
        responseAccounts.push({
          id: account.id,
          balance: newCreditBalance,
          balance_before: creditBalanceBefore,
          currency: account.currency.toUpperCase(),
        });
      }
    }

    return {
      status: 'successful',
      statusCode: 'AP00',
      statusReason: PaymentMessages.TRANSACTION_SUCCESSFUL,
      accounts: responseAccounts,
    };
  }
  // Mark transaction as pending (future date)
  // Don't update balances, but still return account information
  const responseAccounts = [];
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];

    if (account.id === parsed.debitAccount) {
      responseAccounts.push({
        id: account.id,
        balance: account.balance,
        balance_before: account.balance,
        currency: account.currency.toUpperCase(),
      });
    } else if (account.id === parsed.creditAccount) {
      responseAccounts.push({
        id: account.id,
        balance: account.balance,
        balance_before: account.balance,
        currency: account.currency.toUpperCase(),
      });
    }
  }

  return {
    status: 'pending',
    statusCode: 'AP02',
    statusReason: PaymentMessages.TRANSACTION_PENDING,
    accounts: responseAccounts,
  };
}

module.exports = {
  executeTransaction,
  shouldExecuteImmediately,
  getCurrentUTCDate,
  parseUTCDate,
};
