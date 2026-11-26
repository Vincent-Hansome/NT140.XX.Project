# MỘC · Cửa hàng thời trang

MỘC là đồ án NT140 mô phỏng quy trình mua và bán quần áo. Khách chọn đúng cỡ, màu, đặt hàng và theo dõi đến khi nhận hàng. Quản trị viên quản lý tồn kho, khuyến mãi, giao hàng và hỗ trợ sau mua. Bản demo có **30 sản phẩm thuộc 9 danh mục**, mỗi sản phẩm có ảnh riêng và giá tính bằng đồng Việt Nam.

## Chạy bản demo

Cần Docker Desktop đang chạy với Linux containers và Docker Compose hỗ trợ `!override`. Các lệnh dưới đây dùng PowerShell. Khối lệnh đầu tiên chuyển từ thư mục gốc repository vào thư mục ứng dụng và tạo tệp cấu hình nếu chưa có.

```powershell
Set-Location .\web-clothing-store
if (-not (Test-Path .\docker\.env.customer-support)) {
    Copy-Item .\docker\.env.example .\docker\.env.customer-support
}
```

Trên máy mới, mở `docker/.env.customer-support` và điền các giá trị sau. Khi dùng lại volume đã có dữ liệu, giữ thông tin kết nối của lần khởi tạo.

| Biến | Giá trị cho bản local |
|---|---|
| `DB_NAME` | `web-clothing-store`, tên database mà schema và seed sử dụng |
| `DB_USER`, `DB_PASSWORD` | Tên và mật khẩu của tài khoản MySQL dành cho backend, ví dụ tên `moc_store` |
| `MYSQL_ROOT_PASSWORD` | Mật khẩu riêng cho tài khoản quản trị MySQL |
| `JWT_SECRET` | Chuỗi bí mật ngẫu nhiên dùng để ký phiên đăng nhập |

Khởi động bốn dịch vụ. Biến `$mocCompose` giữ các tùy chọn dùng chung cho những lệnh Docker tiếp theo trong cùng cửa sổ PowerShell.

```powershell
$mocCompose = @('--env-file', 'docker/.env.customer-support', '-f', 'docker/docker-compose.yml', '-f', 'docker/customer-support.local.yml')
docker compose @mocCompose up -d --build --wait
docker compose @mocCompose ps
```

Khi `gateway`, `frontend`, `backend` và `db` đều báo `healthy`, mở [cửa hàng MỘC](http://localhost:3000). Cấu hình `customer-support` dùng project `moc-customer-support` và mở cổng `127.0.0.1:3000` trên máy chạy Docker.

### Tài khoản demo

Hai tài khoản sau được tạo khi khởi tạo database mới. Bạn cũng có thể [đăng ký tài khoản khách](http://localhost:3000/register). Nếu đã đổi mật khẩu của tài khoản mẫu, dùng mật khẩu đã đổi.

| Vai trò | Email | Mật khẩu ban đầu |
|---|---|---|
| Admin | admin@webapp.lab | 123456 |
| User | hacker@webapp.lab | 123456 |

Trong **Tài khoản**, chọn **Đổi mật khẩu** để mở biểu mẫu. **Hủy** đóng biểu mẫu và xóa phần vừa nhập. Đổi thành công sẽ kết thúc các phiên cũ và yêu cầu đăng nhập lại.

## Dùng 10 chức năng của cửa hàng

| Chức năng | Cách sử dụng |
|---|---|
| 1. Chọn cỡ và màu | Mở [Bộ sưu tập](http://localhost:3000/products), chọn một sản phẩm rồi chọn biến thể. Hai biến thể khác nhau được giữ thành hai dòng giỏ hàng. Admin chỉnh tồn kho từng tổ hợp trong [Quản lý sản phẩm](http://localhost:3000/admin/products). |
| 2. Tìm kiếm và lọc | Trong **Bộ sưu tập**, nhập tên hoặc kết hợp danh mục, khoảng giá, cỡ, màu và tình trạng còn hàng. Nếu chọn cả cỡ và màu, kết quả phải có đúng tổ hợp đó. |
| 3. Hội thoại hỗ trợ | Từ [Hỗ trợ](http://localhost:3000/support), gửi yêu cầu chung hoặc chọn một đơn của mình. Khách và admin có thể trả lời nhiều lượt trong cùng hội thoại. |
| 4. Theo dõi giao hàng | Admin mở [Quản lý đơn hàng](http://localhost:3000/admin/orders) để xác nhận, đóng gói, bàn giao vận chuyển và xác nhận đã giao. Khách mở [Đơn hàng của tôi](http://localhost:3000/orders) để xem thời điểm từng bước. |
| 5. Đổi trả từng mặt hàng | Trong đơn đã giao, khách chọn mặt hàng, hình thức đổi hoặc trả, số lượng và lý do. Admin [duyệt hoặc từ chối](http://localhost:3000/admin/orders#returns). Khách xem kết quả trong chi tiết đơn. |
| 6. Mã giảm giá | Admin [tạo mã](http://localhost:3000/admin/orders#coupons) theo số tiền hoặc phần trăm, đặt hạn dùng, giá trị đơn tối thiểu và số lượt. Khách áp mã tại [Thanh toán](http://localhost:3000/checkout) để xem tổng tiền trước khi xác nhận. |
| 7. Danh sách yêu thích | Bấm **Yêu thích** trên thẻ hoặc trang chi tiết sản phẩm. Mở [Danh sách yêu thích](http://localhost:3000/wishlist) để bỏ lưu hoặc quay lại chọn cỡ, màu. |
| 8. Đánh giá sau mua | Sau khi đơn giao thành công, khách có thể chấm 1–5 sao và viết nhận xét. Mỗi khách được đánh giá một lần cho mỗi sản phẩm đã mua. |
| 9. Báo cáo bán hàng | Trong [Báo cáo](http://localhost:3000/admin/reports), admin chọn khoảng ngày để xem doanh thu sau giảm giá, số đơn đã giao và sản phẩm bán chạy theo ngày giao tại Việt Nam. Bảng tồn kho hiển thị các biến thể hiện còn tối đa 5 đơn vị. |
| 10. Thông báo tài khoản | Khách nhận thông báo khi đơn chuyển trạng thái hoặc admin gửi phản hồi hỗ trợ. Bấm [Thông báo](http://localhost:3000/notifications) rồi chọn một mục để đánh dấu đã đọc và mở đúng đơn hoặc hội thoại. |

**Thử một đơn từ đầu đến cuối.** Mở hai phiên trình duyệt riêng và đăng nhập một phiên khách, một phiên admin. Admin tạo mã giảm giá. Khách chọn biến thể, áp mã và đặt hàng. Admin cập nhật từng bước đến **Đã giao**. Lúc này khách có thể mở thông báo, xem lịch sử giao và thử đánh giá hoặc yêu cầu đổi trả. Đơn vừa giao cũng xuất hiện trong báo cáo của ngày giao.

## Kiến trúc và mã nguồn

```text
Trình duyệt → Nginx (:80) → Frontend Express/EJS (:3000) → API Express (:3001) → MySQL 8.0 (:3306)
```

Trình duyệt dùng cùng địa chỉ cho giao diện, `/api` và `/uploads`. Frontend phục vụ ảnh danh mục từ `/images/catalog/` và chuyển tiếp yêu cầu API, ảnh tải lên sang backend. Trong cấu hình local ở trên, chỉ gateway công bố cổng ra máy chủ.

| Thư mục | Nội dung |
|---|---|
| [frontend/](frontend/) | Trang EJS, CSS, JavaScript và ảnh sản phẩm |
| [backend/src/](backend/src/) | API, xác thực, phân quyền và giao dịch giỏ hàng, tồn kho, đơn hàng |
| [database/](database/) | Schema MySQL, tài khoản demo và dữ liệu danh mục |
| [backend/scripts/](backend/scripts/) | Các chương trình cập nhật cấu trúc và dữ liệu từ phiên bản cũ |
| [docker/](docker/) và [gateway/](gateway/) | Dockerfile, cấu hình Compose và Nginx |
| [backend/test/](backend/test/) | Kiểm thử HTTP, giao diện, nghiệp vụ và khôi phục giao dịch |

Khi phát triển client, dùng cookie phiên HttpOnly và lấy CSRF token tại `GET /api/auth/csrf` cho các yêu cầu ghi. Khi tạo đơn qua `POST /api/orders`, gửi `Idempotency-Key` dạng UUID v4. Nếu mất phản hồi, gửi lại cùng khóa để lấy đơn đã tạo. Checkout ghi đơn, trừ tồn kho và ghi nhận lượt dùng mã trong cùng giao dịch.

## Cập nhật và giữ dữ liệu

- **Cập nhật mã nguồn.** Chạy lại `docker compose @mocCompose up -d --build --wait`. Backend chạy [migration tính năng](backend/scripts/migrate-features.cjs) trước khi nhận yêu cầu. MySQL lưu trong volume `db_data`, còn ảnh admin tải lên nằm trong volume `support_uploads` của cùng project.
- **Dừng hoặc mở lại.** Dùng `docker compose @mocCompose stop` và `docker compose @mocCompose start`. Giữ cả hai volume khi cần dùng lại đơn hàng, tài khoản và ảnh tải lên.
- **Nạp danh mục vào database cũ.** MySQL tự chạy schema và seed trong lần khởi tạo volume đầu tiên. Với volume đã có dữ liệu nhưng chưa có danh mục MỘC, chạy hai lệnh dưới đây. [Seed danh mục](database/seeders/02_catalog.sql) ghi nhận lần nạp và giữ các chỉnh sửa sau đó của admin.

```powershell
docker compose @mocCompose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -u "$MYSQL_USER" "$MYSQL_DATABASE" < /docker-entrypoint-initdb.d/02_catalog.sql'
docker compose @mocCompose exec -T backend npm run migrate:features
```

Để chẩn đoán lỗi khởi động, dùng `docker compose @mocCompose logs --tail 80 backend db`. Nếu cần khôi phục dữ liệu, sao lưu cả MySQL và ảnh tải lên, rồi kiểm tra bản phục hồi trong môi trường riêng. [Tài liệu migration và phục hồi](database/migrations/README.md)

## Kiểm thử

Để chạy test ngoài Docker, dùng Node.js 24. Từ thư mục `web-clothing-store`, cài phụ thuộc của cả backend và frontend rồi chạy bộ test mặc định.

```powershell
npm.cmd --prefix backend ci
npm.cmd --prefix frontend ci
npm.cmd --prefix backend test
```

| Lệnh chạy từ `web-clothing-store` | Phạm vi và điều kiện |
|---|---|
| `npm.cmd --prefix backend run test:mysql` | Giỏ hàng, tồn kho, checkout, mã giảm giá, đổi trả, thông báo và báo cáo. Cần MySQL thử riêng ở `127.0.0.1:13316`. |
| `npm.cmd --prefix backend run test:categories:mysql` | Migration danh mục trên MySQL thử riêng ở cổng `13317`. |
| `npm.cmd --prefix backend run test:support:mysql` | Quyền truy cập, hội thoại, yêu thích và đánh giá. Tự tạo MySQL tạm bằng Docker. Bật `SUPPORT_UI_SMOKE=1` và cung cấp Playwright cùng Chrome để kiểm tra thêm giao diện. |
| `npm.cmd --prefix backend run test:recovery:mysql` | Kiểm tra gửi lại checkout khi mất phản hồi, khóa và rollback bằng MySQL tạm. |
| `npm.cmd --prefix backend run test:availability:mysql` | Kiểm tra phản hồi và phục hồi của API khi database bị gián đoạn, bằng MySQL tạm. |

Trong lần kiểm tra bản 10 chức năng ngày **25/11/2026**, **81 kiểm thử tự động và 23 kiểm thử tích hợp MySQL đã đạt**. Luồng mua hàng và xử lý đơn cũng đã được thử bằng Chrome trên môi trường riêng. Cách chuẩn bị database kiểm thử và chạy từng bộ được ghi trong [hướng dẫn kiểm thử](backend/test/README.md).

## Nguồn ảnh

Ảnh danh mục được lưu cùng ứng dụng dưới dạng WebP. Nguồn gồm [DummyJSON](https://dummyjson.com/products), [Fake Store API](https://fakestoreapi.com/products) và Unsplash ([hoodie](https://images.unsplash.com/photo-1556821840-3a63f95609a7), [jeans](https://images.unsplash.com/photo-1542272604-787c3835535d), [chino](https://images.unsplash.com/photo-1473966968600-fa801b869a1a)). Hai ảnh biên tập trên trang chủ là của Mert Coşkun và Teona Swift trên Pexels. [Thông tin ảnh trong giao diện](frontend/views/products/list.ejs)
