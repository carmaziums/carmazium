"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateListingDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_listing_dto_1 = require("./create-listing.dto");
class UpdateListingDto extends (0, mapped_types_1.PartialType)(create_listing_dto_1.CreateListingDto) {
}
exports.UpdateListingDto = UpdateListingDto;
//# sourceMappingURL=update-listing.dto.js.map