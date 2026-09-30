-- HGV listings use commercial-vehicle body styles rather than passenger-car
-- shapes. These enum additions are additive and leave existing listings intact.

ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'HGV_TRACTOR_UNIT';
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'HGV_BOX';
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'HGV_CURTAIN_SIDER';
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'HGV_FLATBED';
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'HGV_TIPPER';
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'HGV_DROPSIDE';
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'HGV_TANKER';
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'HGV_REFRIGERATED';
ALTER TYPE "body_type" ADD VALUE IF NOT EXISTS 'HGV_CAR_TRANSPORTER';
