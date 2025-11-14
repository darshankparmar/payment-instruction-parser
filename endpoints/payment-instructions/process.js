const { createHandler } = require('@app-core/server');
const { appLogger } = require('@app-core/logger');
const parseInstructionService = require('@app/services/payment-processor/parse-instruction');

module.exports = createHandler({
  path: '/payment-instructions',
  method: 'post',
  middlewares: [],
  async onResponseEnd(rc, rs) {
    appLogger.info(
      {
        requestContext: rc,
        response: rs,
      },
      'payment-instructions-request-completed'
    );
  },
  async handler(rc, helpers) {
    appLogger.info(
      {
        instruction: rc.body?.instruction,
        accountCount: rc.body?.accounts?.length,
      },
      'payment-instructions-request-received'
    );

    const payload = rc.body;

    try {
      const response = await parseInstructionService(payload);

      // Successful or pending transactions return HTTP 200
      appLogger.info(
        {
          status: response.status,
          statusCode: response.status_code,
        },
        'payment-instructions-success'
      );

      return {
        status: helpers.http_statuses.HTTP_200_OK,
        data: response,
      };
    } catch (error) {
      // Validation errors return HTTP 400
      if (error.isApplicationError && error.details) {
        appLogger.warn(
          {
            errorCode: error.errorCode,
            statusCode: error.details.status_code,
            statusReason: error.details.status_reason,
          },
          'payment-instructions-validation-error'
        );

        return {
          status: helpers.http_statuses.HTTP_400_BAD_REQUEST,
          data: error.details,
        };
      }

      // Re-throw unexpected errors to be handled by framework
      appLogger.error(
        {
          error: error.message,
          stack: error.stack,
        },
        'payment-instructions-unexpected-error'
      );

      throw error;
    }
  },
});
