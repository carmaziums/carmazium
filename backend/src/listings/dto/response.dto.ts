import { ApiProperty } from '@nestjs/swagger';

export class StandardResponse<T> {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty()
    data: T;

    @ApiProperty({ example: '2026-02-01T00:45:00.000Z' })
    timestamp: string;

    constructor(data: T, success: boolean = true) {
        this.success = success;
        this.data = data;
        this.timestamp = new Date().toISOString();
    }
}

export class PaginatedResponse<T> {
    @ApiProperty({ example: true })
    success: boolean;

    @ApiProperty()
    data: T[];

    @ApiProperty({
        example: {
            total: 100,
            page: 1,
            limit: 20,
            totalPages: 5,
        },
    })
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };

    @ApiProperty({ example: '2026-02-01T00:45:00.000Z' })
    timestamp: string;

    constructor(
        data: T[],
        total: number,
        page: number,
        limit: number,
        success: boolean = true,
    ) {
        this.success = success;
        this.data = data;
        this.pagination = {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
        this.timestamp = new Date().toISOString();
    }
}
