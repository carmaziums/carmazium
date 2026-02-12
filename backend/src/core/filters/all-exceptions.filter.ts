import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    constructor(private readonly httpAdapterHost: HttpAdapterHost) { }

    catch(exception: unknown, host: ArgumentsHost): void {
        const { httpAdapter } = this.httpAdapterHost;
        const ctx = host.switchToHttp();

        const httpStatus =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const exceptionResponse =
            exception instanceof HttpException ? exception.getResponse() : null;

        const message =
            exception instanceof HttpException
                ? typeof exceptionResponse === 'object' && exceptionResponse !== null
                    ? (exceptionResponse as any).message || exception.message
                    : exception.message
                : 'Internal Server Error';

        // Log the error (sanitized for production)
        if (httpStatus >= 500) {
            this.logger.error(
                `Unhandles Exception: ${exception instanceof Error ? exception.message : exception}`,
                exception instanceof Error ? exception.stack : '',
            );
        }

        const responseBody = {
            success: false,
            message: message,
            statusCode: httpStatus,
            timestamp: new Date().toISOString(),
            path: httpAdapter.getRequestUrl(ctx.getRequest()),
        };

        httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
    }
}
