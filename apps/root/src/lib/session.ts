export class ApiUnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'ApiUnauthorizedError';
  }
}
