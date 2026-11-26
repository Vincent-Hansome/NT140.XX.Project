-- Shared by fresh installations and existing MySQL 8 databases.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS catalog_seed_runs (
    seed_name VARCHAR(64) CHARACTER SET ascii PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Inherit the live column types/collations, including those on older volumes.
DROP TEMPORARY TABLE IF EXISTS moc_catalog_items;
CREATE TEMPORARY TABLE moc_catalog_items AS
SELECT p.name, p.description, p.price, p.stock, p.size, p.color, p.image_url,
       c.name AS category_name
FROM products AS p CROSS JOIN categories AS c
LIMIT 0;

INSERT INTO moc_catalog_items
    (name, description, price, stock, size, color, image_url, category_name)
VALUES
    ('Áo khoác kaki túi hộp', 'Dáng khoác ngắn màu cát, cổ bẻ và hai túi nắp phía trước.', 649000, 18, 'L', 'Be cát', '/images/catalog/ao-khoac-kaki.webp', 'Áo khoác'),
    ('Quần jeans indigo', 'Quần denim xanh đậm với đường chỉ tương phản và túi sau.', 479000, 26, '30', 'Xanh indigo', '/images/catalog/quan-jeans-indigo.webp', 'Quần'),
    ('Đầm suông hàng nút', 'Đầm không tay tông xám nhạt, hàng nút chạy dọc thân trước.', 529000, 16, 'M', 'Xám sương', '/images/catalog/dam-suong-hang-nut.webp', 'Đầm'),
    ('Túi xách quai đôi indigo', 'Túi dáng hộp có hai quai tròn và thân xanh đậm.', 439000, 15, 'Một cỡ', 'Xanh indigo', '/images/catalog/tui-xanh-indigo.webp', 'Túi và ba lô'),
    ('Áo thun cổ thuyền', 'Áo trắng cổ rộng với tay rủ và nếp nhún nhẹ bên hông.', 189000, 32, 'M', 'Trắng', '/images/catalog/ao-thun-co-thuyen.webp', 'Áo thun'),
    ('Sơ mi caro xanh', 'Áo sơ mi dài tay kẻ ô xanh, cổ gập và hàng nút trước.', 349000, 24, 'L', 'Xanh ô vuông', '/images/catalog/so-mi-caro-xanh.webp', 'Áo sơ mi'),
    ('Sneaker phối màu nắng', 'Giày thể thao đế răng cưa, phối vàng, xanh và kem.', 699000, 14, '40', 'Vàng phối xanh', '/images/catalog/sneaker-mau-nang.webp', 'Giày'),
    ('Hoodie xám đá', 'Áo nỉ có mũ, dáng rộng vừa với tay dài và bo gấu.', 489000, 23, 'L', 'Xám đá', '/images/catalog/hoodie-xam-da.webp', 'Áo nỉ'),
    ('Đầm caro thắt nơ', 'Đầm caro đen trắng, chân váy xòe và nơ đen ở eo.', 459000, 13, 'S', 'Caro đen trắng', '/images/catalog/dam-caro-no.webp', 'Đầm'),
    ('Ba lô gập miệng', 'Ba lô xanh than có nắp gập, hai dây cài và quai xách.', 569000, 17, 'Một cỡ', 'Xanh than', '/images/catalog/ba-lo-gap-mieng.webp', 'Túi và ba lô'),
    ('Áo dài tay cổ V', 'Áo thun dài tay màu xanh khói với cổ chữ V.', 249000, 28, 'M', 'Xanh khói', '/images/catalog/ao-dai-tay-co-v.webp', 'Áo thun'),
    ('Quần chino màu cát', 'Quần màu cát dáng gọn, dễ xắn gấu để phối với giày thấp cổ.', 419000, 29, '32', 'Be cát', '/images/catalog/quan-chino-cat.webp', 'Quần'),
    ('Kính mát gọng nâu', 'Kính tròng xanh đậm với gọng mảnh và cầu kính ánh kim.', 249000, 20, 'Một cỡ', 'Nâu trà', '/images/catalog/kinh-gong-nau.webp', 'Phụ kiện'),
    ('Áo khoác biker có mũ', 'Áo khoác đen có mũ, khóa kéo trước và đường may ôm thân.', 749000, 11, 'M', 'Đen', '/images/catalog/ao-khoac-biker.webp', 'Áo khoác'),
    ('Đầm chấm xanh', 'Đầm nền trắng với chấm tròn xanh và phần chân váy xòe.', 399000, 18, 'S', 'Trắng phối xanh', '/images/catalog/dam-cham-xanh.webp', 'Đầm'),
    ('Giày gót nhọn đen', 'Giày cao gót mũi nhọn, thân đen trơn và lót nâu.', 489000, 14, '38', 'Đen', '/images/catalog/giay-got-nhon-den.webp', 'Giày'),
    ('Sơ mi hoa biển', 'Áo sơ mi tay ngắn in hoa sáng trên nền xanh biển.', 319000, 21, 'M', 'Xanh biển', '/images/catalog/so-mi-hoa-bien.webp', 'Áo sơ mi'),
    ('Ba lô trắng ngà', 'Ba lô dáng đứng, nắp gập tối giản và quai đeo mảnh.', 399000, 13, 'Một cỡ', 'Trắng ngà', '/images/catalog/ba-lo-trang-nga.webp', 'Túi và ba lô'),
    ('Áo raglan hai màu', 'Áo thân sáng màu phối tay đen, cổ tròn có nẹp nút.', 229000, 31, 'L', 'Trắng phối đen', '/images/catalog/ao-raglan-hai-mau.webp', 'Áo thun'),
    ('Khuyên tai giọt xanh', 'Khuyên dáng thả, đính viên đá xanh và viền ánh vàng.', 169000, 22, 'Một cỡ', 'Xanh lục', '/images/catalog/khuyen-tai-giot-xanh.webp', 'Phụ kiện'),
    ('Đầm hoa đêm', 'Đầm dài nền đen, họa tiết hoa hồng và phần vai trễ.', 679000, 10, 'M', 'Đen hoa hồng', '/images/catalog/dam-hoa-dem.webp', 'Đầm'),
    ('Áo khoác tím mận', 'Áo khoác khóa kéo với cổ cao và mũ trùm cùng màu.', 629000, 12, 'L', 'Tím mận', '/images/catalog/ao-khoac-tim-man.webp', 'Áo khoác'),
    ('Sneaker cổ cao đỏ', 'Giày cổ cao phối mảng màu đỏ và trắng với dây buộc đen.', 729000, 19, '41', 'Đỏ trắng', '/images/catalog/sneaker-co-cao-do.webp', 'Giày'),
    ('Sơ mi caro đỏ', 'Áo sơ mi dài tay kẻ caro đỏ đen với túi ngực.', 359000, 24, 'M', 'Đỏ đen', '/images/catalog/so-mi-caro-do.webp', 'Áo sơ mi'),
    ('Đồng hồ dây nâu', 'Đồng hồ mặt tròn sáng màu, viền ánh kim và dây nâu.', 569000, 11, 'Một cỡ', 'Nâu', '/images/catalog/dong-ho-day-nau.webp', 'Phụ kiện'),
    ('Áo khoác gió xanh đêm', 'Áo khoác dáng dài có mũ, cổ tay lót sọc và hàng cúc trước.', 579000, 16, 'M', 'Xanh đêm', '/images/catalog/ao-khoac-gio-xanh.webp', 'Áo khoác'),
    ('Đầm chấm bi thắt eo', 'Đầm trắng chấm bi nhỏ, thân trên quây và nơ lệch eo.', 499000, 15, 'S', 'Trắng chấm bi', '/images/catalog/dam-cham-bi-trang.webp', 'Đầm'),
    ('Giày cao gót đỏ son', 'Giày đỏ son cổ thấp, thân trơn và mũi nhọn.', 469000, 12, '37', 'Đỏ son', '/images/catalog/giay-cao-got-do.webp', 'Giày'),
    ('Áo thun họa tiết chim', 'Áo trắng tay ngắn có hình in đồ họa đen ở mặt trước.', 219000, 26, 'L', 'Trắng', '/images/catalog/ao-thun-hoa-tiet-chim.webp', 'Áo thun'),
    ('Áo thun Be Kind', 'Áo thun tím tay ngắn, mặt trước in chữ Be Kind.', 199000, 25, 'M', 'Tím', '/images/catalog/ao-thun-be-kind.webp', 'Áo thun');

START TRANSACTION;
-- Concurrent and later runs skip the batch. Admin edits/deletions stay intact.
INSERT IGNORE INTO catalog_seed_runs (seed_name) VALUES ('moc-fashion-2026-11');
SET @install_moc_catalog = ROW_COUNT();

INSERT INTO categories (name)
SELECT DISTINCT item.category_name
FROM moc_catalog_items AS item
LEFT JOIN categories AS existing ON existing.name = item.category_name
WHERE @install_moc_catalog = 1 AND existing.id IS NULL;

INSERT INTO products (name, description, price, stock, size, color, image_url, category_id)
SELECT item.name, item.description, item.price, item.stock, item.size, item.color,
       item.image_url, category.id
FROM moc_catalog_items AS item
JOIN categories AS category ON category.name = item.category_name
LEFT JOIN products AS existing ON existing.name = item.name OR existing.image_url = item.image_url
WHERE @install_moc_catalog = 1 AND existing.id IS NULL;
COMMIT;

DROP TEMPORARY TABLE moc_catalog_items;
