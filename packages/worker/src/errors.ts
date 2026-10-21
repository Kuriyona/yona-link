export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'api_error'
  ) {
    super(message);
  }
}
