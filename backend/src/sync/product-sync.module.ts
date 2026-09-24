import { Global, Module } from '@nestjs/common';
import { ProductSyncGateway } from './product-sync.gateway';

@Global()
@Module({
  providers: [ProductSyncGateway],
  exports: [ProductSyncGateway],
})
export class ProductSyncModule {}
