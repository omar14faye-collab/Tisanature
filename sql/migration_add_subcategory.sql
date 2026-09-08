-- Migration: Add subcategory to products table
ALTER TABLE `products` ADD COLUMN `subcategory` VARCHAR(50) DEFAULT NULL AFTER `category`;

-- Optional: Initial mapping for existing cosmétiques
UPDATE `products` SET `subcategory` = 'peau'    WHERE `category` = 'cosmetiques' AND (`name` LIKE '%Lait%' OR `name` LIKE '%Huile%' OR `name` LIKE '%Gommage%' OR `name` LIKE '%Savon%');
UPDATE `products` SET `subcategory` = 'visage'  WHERE `category` = 'cosmetiques' AND (`name` LIKE '%Masque%' OR `name` LIKE '%Sérum%' OR `name` LIKE '%Baume%');
UPDATE `products` SET `subcategory` = 'cheveux' WHERE `category` = 'cosmetiques' AND (`name` LIKE '%Cheveux%');
