/**
 * Parse Instruction Service
 * Main orchestration service for parsing and executing payment instructions
 */

const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const { parseInstruction } = require('./helpers/parser');
const { validateTransaction } = require('./helpers/validator');
const { executeTransaction } = require('./helpers/executor');
const PaymentMessages = require('../../messages/payment');

// VSL validation spec for input schema
const inputSpec = `root {
  accounts[] {
    id string
    balance number
    currency string
  }
  instruction string
}`;

// Parse the spec at module load time
const parsedInputSpec = validator.parse(inputSpec);

/**
 * Build response object with all required fields
 * @param {Object} parsed - Parsed instruction object
 * @param {Object} executionResult - Execution result object
 * @returns {Object} - Complete response object
 */
function buildResponse(parsed, executionResult) {
  return {
    type: parsed.type,
    amount: parsed.amount,
    currency: parsed.currency,
    debit_account: parsed.debitAccount,
    credit_account: parsed.creditAccount,
    execute_by: parsed.executeBy,
    status: executionResult.status,
    status_reason: executionResult.statusReason,
    status_code: executionResult.statusCode,
    accounts: executionResult.accounts,
  };
}

/**
 * Build error response for validation failures
 * @param {Object} parsed - Parsed instruction object
 * @param {Object} validationResult - Validation result with error details
 * @returns {Object} - Error response object
 */
function buildErrorResponse(parsed, validationResult) {
  return {
    type: parsed.type,
    amount: parsed.amount,
    currency: parsed.currency,
    debit_account: parsed.debitAccount,
    credit_account: parsed.creditAccount,
    execute_by: parsed.executeBy,
    status: 'failed',
    status_reason: validationResult.errorMessage,
    status_code: validationResult.errorCode,
    accounts: [],
  };
}

/**
 * Build response for unparseable instructions
 * @param {Array} parseErrors - Array of parse error messages
 * @returns {Object} - Error response with nulls
 */
function buildUnparseableResponse(parseErrors) {
  // Determine appropriate error code and message based on parse errors
  let statusCode = 'SY03';
  let statusReason = PaymentMessages.MALFORMED_INSTRUCTION;

  if (parseErrors.length > 0) {
    const errorMsg = parseErrors[0].toLowerCase();

    if (errorMsg.includes('missing')) {
      statusCode = 'SY01';
      statusReason = PaymentMessages.MISSING_KEYWORD;
    } else if (errorMsg.includes('order')) {
      statusCode = 'SY02';
      statusReason = PaymentMessages.INVALID_KEYWORD_ORDER;
    }
  }

  return {
    type: null,
    amount: null,
    currency: null,
    debit_account: null,
    credit_account: null,
    execute_by: null,
    status: 'failed',
    status_reason: statusReason,
    status_code: statusCode,
    accounts: [],
  };
}

/**
 * Main service function to parse and execute payment instructions
 * @param {Object} serviceData - Input data containing accounts and instruction
 * @returns {Object} - Structured response with transaction results
 */
async function parseInstructionService(serviceData) {
  let validatedData;
  let parsed;
  let response;

  try {
    // Log request received
    appLogger.info(
      {
        instruction: serviceData.instruction,
        accountCount: serviceData.accounts ? serviceData.accounts.length : 0,
      },
      'parse-instruction-started'
    );

    // Validate input schema using VSL validator
    try {
      validatedData = validator.validate(serviceData, parsedInputSpec);
    } catch (validationError) {
      appLogger.error(
        {
          error: validationError.message,
          serviceData,
        },
        'input-validation-failed'
      );

      throwAppError(`Invalid request data: ${validationError.message}`, ERROR_CODE.INVLDDATA);
    }

    // Parse instruction string to extract components
    appLogger.info({ instruction: validatedData.instruction }, 'parsing-instruction');

    parsed = parseInstruction(validatedData.instruction);

    appLogger.info(
      {
        parsed,
        hasErrors: parsed.parseErrors.length > 0,
      },
      'instruction-parsed'
    );

    // Check if instruction is unparseable
    if (parsed.parseErrors.length > 0) {
      appLogger.warn(
        {
          parseErrors: parsed.parseErrors,
          instruction: validatedData.instruction,
        },
        'unparseable-instruction'
      );

      response = buildUnparseableResponse(parsed.parseErrors);

      appLogger.info(
        {
          statusCode: response.status_code,
          status: response.status,
        },
        'parse-instruction-completed'
      );

      throwAppError(response.status_reason, ERROR_CODE.INVLDDATA, {
        details: response,
      });
    }

    // Validate business rules
    appLogger.info(
      {
        debitAccount: parsed.debitAccount,
        creditAccount: parsed.creditAccount,
        amount: parsed.amount,
        currency: parsed.currency,
      },
      'validating-business-rules'
    );

    const validationResult = validateTransaction(parsed, validatedData.accounts);

    if (!validationResult.isValid) {
      appLogger.warn(
        {
          errorCode: validationResult.errorCode,
          errorMessage: validationResult.errorMessage,
        },
        'validation-failed'
      );

      response = buildErrorResponse(parsed, validationResult);

      appLogger.info(
        {
          statusCode: response.status_code,
          status: response.status,
        },
        'parse-instruction-completed'
      );

      throwAppError(validationResult.errorMessage, ERROR_CODE.INVLDDATA, {
        details: response,
      });
    }

    appLogger.info('validation-passed');

    // Execute transaction
    appLogger.info(
      {
        executeBy: parsed.executeBy,
        amount: parsed.amount,
      },
      'executing-transaction'
    );

    const executionResult = executeTransaction(parsed, validatedData.accounts);

    appLogger.info(
      {
        status: executionResult.status,
        statusCode: executionResult.statusCode,
      },
      'transaction-executed'
    );

    // Build structured response
    response = buildResponse(parsed, executionResult);

    appLogger.info(
      {
        statusCode: response.status_code,
        status: response.status,
      },
      'parse-instruction-completed'
    );

    return response;
  } catch (error) {
    // Handle application errors (validation failures)
    if (error.isApplicationError) {
      appLogger.error(
        {
          errorCode: error.errorCode,
          errorMessage: error.message,
          details: error.details,
        },
        'application-error'
      );

      throw error;
    }

    // Handle unexpected errors
    appLogger.error(
      {
        error: error.message,
        stack: error.stack,
      },
      'unexpected-error'
    );

    throwAppError(
      'An unexpected error occurred while processing the instruction',
      ERROR_CODE.APPERR
    );
  }
}

module.exports = parseInstructionService;
