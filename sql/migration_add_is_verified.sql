ALTER TABLE `products` ADD COLUMN `is_verified` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`;
