export declare enum ListingType {
    AUCTION = "AUCTION",
    CLASSIFIED = "CLASSIFIED"
}
export declare enum ListingStatus {
    DRAFT = "DRAFT",
    ACTIVE = "ACTIVE",
    SOLD = "SOLD"
}
export declare enum FuelType {
    PETROL = "PETROL",
    DIESEL = "DIESEL",
    ELECTRIC = "ELECTRIC",
    HYBRID = "HYBRID",
    PLUGIN_HYBRID = "PLUGIN_HYBRID"
}
export declare enum Transmission {
    MANUAL = "MANUAL",
    AUTOMATIC = "AUTOMATIC",
    SEMI_AUTOMATIC = "SEMI_AUTOMATIC"
}
export declare class CreateListingDto {
    title: string;
    price: number;
    mileage: number;
    year: number;
    vrm: string;
    make?: string;
    model?: string;
    description?: string;
    images: string[];
    listingType: ListingType;
    status?: ListingStatus;
    fuelType?: FuelType;
    transmission?: Transmission;
    color?: string;
    doors?: number;
    seats?: number;
    engineSize?: number;
    bhp?: number;
    features?: string[];
}
