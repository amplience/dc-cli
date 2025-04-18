import { HttpError } from 'dc-management-sdk-js';

const httpErrorFactory: { [key: number]: (httpError: HttpError) => string } = {
  400: (httpError: HttpError) =>
    `Error: Request failed with status code 400\n${JSON.stringify(httpError.response, null, 2)}`,
  401: () => 'Error: Unauthorized - Please ensure your client ID & secret or PAT token are correct.',
  403: (httpError: HttpError) => {
    return httpError.request
      ? `Error: The requested action (${httpError.request.method}: ${httpError.request.url}) is not available (forbidden), ensure you have permission to perform this action.`
      : 'Error: The requested action is not available (forbidden), ensure you have permission to perform this action.';
  },
  429: () => 'Error: Too many requests - Please try again later.',
  500: (httpError: HttpError) => `Error: Internal Server Error - ${httpError.message}`
};

export type SupportedErrors = string | { message: string } | HttpError;

const buildMessage = (err: SupportedErrors): string => {
  if (typeof err === 'string') {
    return `Error: ${err}`;
  }

  if (err instanceof HttpError && err.response) {
    const builder = httpErrorFactory[err.response.status];
    if (builder) {
      return builder(err);
    }
    if (!err.response.status) {
      return `Error: No response from server - check your network connection.`;
    }
  }

  return `Error: ${err.message}`;
};

const generateTimestamp = (): string => {
  return new Date().toISOString();
};

const errorHandler = (err: SupportedErrors): void => {
  console.error(`\n${generateTimestamp()} ${buildMessage(err)}`);
};

export default errorHandler;
