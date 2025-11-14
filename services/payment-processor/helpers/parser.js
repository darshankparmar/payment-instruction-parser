/**
 * Parser module for payment instructions
 * Uses only string manipulation methods (no regex)
 */

/**
 * Normalize instruction string by trimming and handling multiple spaces
 */
function normalizeInstruction(instruction) {
  if (!instruction || typeof instruction !== 'string') {
    return '';
  }

  // Trim and replace multiple spaces with single space
  let normalized = instruction.trim();
  while (normalized.includes('  ')) {
    normalized = normalized.replace('  ', ' ');
  }

  return normalized;
}

/**
 * Find keyword position in uppercase instruction
 */
function findKeyword(upperInstruction, keyword) {
  return upperInstruction.indexOf(keyword);
}

/**
 * Extract value between two positions
 */
function extractBetween(instruction, startPos, endPos) {
  if (startPos === -1 || endPos === -1) {
    return null;
  }
  return instruction.substring(startPos, endPos).trim();
}

/**
 * Parse DEBIT format instruction
 * Format: DEBIT [amount] [currency] FROM ACCOUNT [id] FOR CREDIT TO ACCOUNT [id] [ON [date]]
 */
function parseDebitFormat(instruction, upperInstruction, keywords) {
  const parsed = {
    type: 'DEBIT',
    amount: null,
    currency: null,
    debitAccount: null,
    creditAccount: null,
    executeBy: null,
    parseErrors: [],
  };

  // Extract amount and currency (between DEBIT and FROM)
  const amountCurrencyStr = extractBetween(
    instruction,
    keywords.debit + 5, // 'DEBIT'.length
    keywords.from
  );

  if (amountCurrencyStr) {
    const parts = amountCurrencyStr.trim().split(' ');
    if (parts.length >= 2) {
      parsed.amount = parseInt(parts[0], 10);
      parsed.currency = parts[1].toUpperCase();
    }
  }

  // Extract debit account (between FROM ACCOUNT and FOR)
  const debitAccountStart = keywords.from + 12; // 'FROM ACCOUNT'.length
  const debitAccountStr = extractBetween(instruction, debitAccountStart, keywords.for);
  if (debitAccountStr) {
    parsed.debitAccount = debitAccountStr.trim();
  }

  // Extract credit account (between TO ACCOUNT and ON or end)
  const toAccountPos = upperInstruction.indexOf('TO ACCOUNT', keywords.for);
  if (toAccountPos !== -1) {
    const creditAccountStart = toAccountPos + 10; // 'TO ACCOUNT'.length
    const creditAccountEnd = keywords.on !== -1 ? keywords.on : instruction.length;
    const creditAccountStr = extractBetween(instruction, creditAccountStart, creditAccountEnd);
    if (creditAccountStr) {
      parsed.creditAccount = creditAccountStr.trim();
    }
  }

  // Extract date if ON clause present
  if (keywords.on !== -1) {
    const dateStr = instruction.substring(keywords.on + 2).trim(); // 'ON'.length
    if (dateStr) {
      parsed.executeBy = dateStr;
    }
  }

  return parsed;
}

/**
 * Parse CREDIT format instruction
 * Format: CREDIT [amount] [currency] TO ACCOUNT [id] FOR DEBIT FROM ACCOUNT [id] [ON [date]]
 */
function parseCreditFormat(instruction, upperInstruction, keywords) {
  const parsed = {
    type: 'CREDIT',
    amount: null,
    currency: null,
    debitAccount: null,
    creditAccount: null,
    executeBy: null,
    parseErrors: [],
  };

  // Extract amount and currency (between CREDIT and TO)
  const amountCurrencyStr = extractBetween(
    instruction,
    keywords.credit + 6, // 'CREDIT'.length
    keywords.to
  );

  if (amountCurrencyStr) {
    const parts = amountCurrencyStr.trim().split(' ');
    if (parts.length >= 2) {
      parsed.amount = parseInt(parts[0], 10);
      parsed.currency = parts[1].toUpperCase();
    }
  }

  // Extract credit account (between TO ACCOUNT and FOR)
  const creditAccountStart = keywords.to + 10; // 'TO ACCOUNT'.length
  const creditAccountStr = extractBetween(instruction, creditAccountStart, keywords.for);
  if (creditAccountStr) {
    parsed.creditAccount = creditAccountStr.trim();
  }

  // Extract debit account (between FROM ACCOUNT and ON or end)
  const fromAccountPos = upperInstruction.indexOf('FROM ACCOUNT', keywords.for);
  if (fromAccountPos !== -1) {
    const debitAccountStart = fromAccountPos + 12; // 'FROM ACCOUNT'.length
    const debitAccountEnd = keywords.on !== -1 ? keywords.on : instruction.length;
    const debitAccountStr = extractBetween(instruction, debitAccountStart, debitAccountEnd);
    if (debitAccountStr) {
      parsed.debitAccount = debitAccountStr.trim();
    }
  }

  // Extract date if ON clause present
  if (keywords.on !== -1) {
    const dateStr = instruction.substring(keywords.on + 2).trim(); // 'ON'.length
    if (dateStr) {
      parsed.executeBy = dateStr;
    }
  }

  return parsed;
}

/**
 * Validate keyword presence and order for DEBIT format
 */
function validateDebitFormat(keywords) {
  const errors = [];

  // Check required keywords are present
  if (keywords.debit === -1) {
    errors.push('Missing required keyword: DEBIT');
  }
  if (keywords.from === -1) {
    errors.push('Missing required keyword: FROM');
  }
  if (keywords.account === -1) {
    errors.push('Missing required keyword: ACCOUNT');
  }
  if (keywords.for === -1) {
    errors.push('Missing required keyword: FOR');
  }
  if (keywords.to === -1) {
    errors.push('Missing required keyword: TO');
  }

  // Check keyword order: DEBIT < FROM < FOR < TO
  if (keywords.debit !== -1 && keywords.from !== -1 && keywords.debit >= keywords.from) {
    errors.push('Invalid keyword order: DEBIT must come before FROM');
  }
  if (keywords.from !== -1 && keywords.for !== -1 && keywords.from >= keywords.for) {
    errors.push('Invalid keyword order: FROM must come before FOR');
  }
  if (keywords.for !== -1 && keywords.to !== -1 && keywords.for >= keywords.to) {
    errors.push('Invalid keyword order: FOR must come before TO');
  }

  return errors;
}

/**
 * Validate keyword presence and order for CREDIT format
 */
function validateCreditFormat(keywords) {
  const errors = [];

  // Check required keywords are present
  if (keywords.credit === -1) {
    errors.push('Missing required keyword: CREDIT');
  }
  if (keywords.to === -1) {
    errors.push('Missing required keyword: TO');
  }
  if (keywords.account === -1) {
    errors.push('Missing required keyword: ACCOUNT');
  }
  if (keywords.for === -1) {
    errors.push('Missing required keyword: FOR');
  }
  if (keywords.from === -1) {
    errors.push('Missing required keyword: FROM');
  }

  // Check keyword order: CREDIT < TO < FOR < FROM
  if (keywords.credit !== -1 && keywords.to !== -1 && keywords.credit >= keywords.to) {
    errors.push('Invalid keyword order: CREDIT must come before TO');
  }
  if (keywords.to !== -1 && keywords.for !== -1 && keywords.to >= keywords.for) {
    errors.push('Invalid keyword order: TO must come before FOR');
  }
  if (keywords.for !== -1 && keywords.from !== -1 && keywords.for >= keywords.from) {
    errors.push('Invalid keyword order: FOR must come before FROM');
  }

  return errors;
}

/**
 * Main parser function
 * Parses payment instruction and returns structured data
 */
function parseInstruction(instruction) {
  // Initialize result with null values
  const result = {
    type: null,
    amount: null,
    currency: null,
    debitAccount: null,
    creditAccount: null,
    executeBy: null,
    parseErrors: [],
  };

  // Normalize instruction
  const normalized = normalizeInstruction(instruction);
  if (!normalized) {
    result.parseErrors.push('Empty or invalid instruction');
    return result;
  }

  // Create uppercase version for keyword matching
  const upperInstruction = normalized.toUpperCase();

  // Find all keyword positions
  const keywords = {
    debit: findKeyword(upperInstruction, 'DEBIT'),
    credit: findKeyword(upperInstruction, 'CREDIT'),
    from: findKeyword(upperInstruction, 'FROM'),
    to: findKeyword(upperInstruction, 'TO'),
    account: findKeyword(upperInstruction, 'ACCOUNT'),
    for: findKeyword(upperInstruction, 'FOR'),
    on: findKeyword(upperInstruction, 'ON'),
  };

  // Determine instruction type
  let parsed;
  if (keywords.debit !== -1 && keywords.debit < 5) {
    // DEBIT at start
    // Validate DEBIT format
    const validationErrors = validateDebitFormat(keywords);
    if (validationErrors.length > 0) {
      result.parseErrors = validationErrors;
      return result;
    }

    // Parse DEBIT format
    parsed = parseDebitFormat(normalized, upperInstruction, keywords);
  } else if (keywords.credit !== -1 && keywords.credit < 5) {
    // CREDIT at start
    // Validate CREDIT format
    const validationErrors = validateCreditFormat(keywords);
    if (validationErrors.length > 0) {
      result.parseErrors = validationErrors;
      return result;
    }

    // Parse CREDIT format
    parsed = parseCreditFormat(normalized, upperInstruction, keywords);
  } else {
    result.parseErrors.push('Malformed instruction: must start with DEBIT or CREDIT');
    return result;
  }

  return parsed;
}

module.exports = {
  parseInstruction,
};
