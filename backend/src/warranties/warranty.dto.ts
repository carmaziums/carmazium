import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, Equals, IsArray, IsEmail, IsDefined, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class WarrantySelectionDto {
    @IsIn(['CAR', 'SUV']) vehicleCategory: 'CAR' | 'SUV';
    @Equals(12) months: 12;
    @IsIn([1000, 2000]) repairLimit: 1000 | 2000;
    @IsIn([75, 100, 150, 200]) labourRate: 75 | 100 | 150 | 200;
    @IsArray() @ArrayMaxSize(4) @ArrayUnique()
    @IsIn(['AIRBAGS', 'DRIVER_ASSISTANCE', 'EMISSIONS', 'MULTIMEDIA'], { each: true })
    extras: Array<'AIRBAGS' | 'DRIVER_ASSISTANCE' | 'EMISSIONS' | 'MULTIMEDIA'>;
}
export class WarrantyCustomerDto {
    @IsIn(['Mr', 'Mrs', 'Miss', 'Ms', 'Mx', 'Dr', 'Other']) title: string;
    @Transform(trim) @IsString() @Length(1, 80) firstName: string;
    @Transform(trim) @IsString() @Length(1, 80) lastName: string;
    @Transform(trim) @IsEmail() @Length(3, 254) email: string;
    @Transform(trim) @Matches(/^\+?[\d\s().-]{7,30}$/) phone: string;
    @Transform(trim) @IsString() @Length(3, 160) addressLine1: string;
    @IsOptional() @Transform(trim) @IsString() @Length(0, 160) addressLine2?: string;
    @Transform(trim) @IsString() @Length(2, 100) town: string;
    @IsOptional() @Transform(trim) @IsString() @Length(0, 100) county?: string;
    @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
    @Matches(/^(GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/) postcode: string;
}
export class WarrantyVehicleDto {
    @Transform(({ value }) => typeof value === 'string' ? value.replace(/\s/g, '').toUpperCase() : value)
    @Matches(/^[A-Z0-9]{2,8}$/) vrm: string;
    @Transform(trim) @IsString() @Length(1, 80) make: string;
    @Transform(trim) @IsString() @Length(1, 120) model: string;
    @IsInt() @Min(0) @Max(1000000) mileage: number;
    @IsInt() @Min(0) @Max(12000) engineCc: number;
    @IsIn(['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC', 'OTHER']) fuelType: string;
    @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) firstRegistrationDate: string;
    @IsInt() @Min(1) @Max(100000000) retailValuePence: number;
    @IsIn(['UK', 'EU', 'JAPAN', 'OTHER']) origin: string;
    @IsIn(['FULL', 'PART', 'LAST_SERVICE_ONLY', 'UNKNOWN']) serviceHistory: string;
    @IsOptional() @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) lastServiceDate?: string;
    @IsOptional() @IsInt() @Min(0) @Max(1000000) lastServiceMileage?: number;
    @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) purchaseDate: string;
    @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) requestedStartDate: string;
    @IsIn(['NONE', 'KNOWN']) knownFaults: string;
    @IsOptional() @Transform(trim) @IsString() @Length(0, 2000) faultDetails?: string;
    @Transform(({ obj, key }) => obj[key]) @Equals(true) detailsConfirmed: boolean;
}
export class WarrantyAccessDto {
    @Matches(/^[a-f0-9]{64}$/) accessToken: string;
}
export class CreateWarrantyQuoteDto extends WarrantyAccessDto {
    @IsUUID() requestId: string;
    @IsOptional() @IsUUID() listingId?: string;
    @IsDefined() @ValidateNested() @Type(() => WarrantyCustomerDto) customer: WarrantyCustomerDto;
    @IsDefined() @ValidateNested() @Type(() => WarrantyVehicleDto) vehicle: WarrantyVehicleDto;
    @IsDefined() @ValidateNested() @Type(() => WarrantySelectionDto) selection: WarrantySelectionDto;
    @Transform(({ obj, key }) => obj[key]) @Equals(true) consent: boolean;
}
export class IssueWarrantyDto {
    @Transform(trim) @IsString() @Length(3, 120) warrantyReference: string;
    @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) coverStart: string;
    @IsISO8601({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) coverEnd: string;
    @Transform(({ obj, key }) => obj[key]) @Equals(true) supplierPaidAndIssued: boolean;
}
export class RefundWarrantyDto {
    @Transform(trim) @IsString() @Length(10, 500) reason: string;
}
