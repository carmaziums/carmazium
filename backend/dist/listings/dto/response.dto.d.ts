export declare class StandardResponse<T> {
    success: boolean;
    data: T;
    timestamp: string;
    constructor(data: T, success?: boolean);
}
export declare class PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    timestamp: string;
    constructor(data: T[], total: number, page: number, limit: number, success?: boolean);
}
