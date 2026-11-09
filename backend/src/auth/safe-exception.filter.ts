import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeExceptionFilter.name);
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const parserType = error && typeof error === 'object' && 'type' in error ? error.type : undefined;
    if (parserType === 'entity.parse.failed' || parserType === 'entity.too.large') {
      const status = parserType === 'entity.too.large' ? 413 : 400;
      response.status(status).json({ statusCode: status, message: status === 413 ? 'Request body too large' : 'Invalid JSON body' });
      return;
    }
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (status >= 500) {
      // Never log the request, query, error object or stack in production.
      if (process.env.NODE_ENV === 'production') this.logger.error('An internal request error occurred.');
      else this.logger.error(error instanceof Error ? error.stack : 'An internal request error occurred.');
      response.status(status).json({ statusCode: status, message: 'Internal server error' });
      return;
    }
    const body = (error as HttpException).getResponse();
    response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}
