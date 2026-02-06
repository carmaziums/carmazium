import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user || {
            id: 'e1111eb8-e6cf-44cf-bbd3-ea3780615455',
            email: 'fallback@test.com',
            role: 'BUYER'
        };
    },
);
