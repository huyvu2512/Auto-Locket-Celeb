# 🎭 Auto Locket Celeb v1.4

Công cụ tự động hóa việc gửi lời mời kết bạn với các celeb trên trang `https://locket.binhake.dev`, giúp bạn tiết kiệm thời gian. Công cụ được tạo bởi Huy Vũ.

## ✨ Tính Năng Nổi Bật

-   **Xử Lý Hàng Loạt**: Nhập danh sách nhiều ID celeb, công cụ sẽ xử lý lần lượt.
-   **Chọn Nhanh Thông Minh**:
    -   Tự động quét danh sách bạn bè hiện tại của bạn trên trang Locket.
    -   Hiển thị danh sách celeb có sẵn, **chỉ bao gồm những người bạn chưa kết bạn**.
    -   Cho phép chọn từng người hoặc **chọn tất cả** người chưa kết bạn vào danh sách chờ.
    -   **Ngăn chặn trùng lặp**: Tự động vô hiệu hóa celeb đã được chọn.
    -   Nút **Quét lại (🔄)** để làm mới danh sách chọn nhanh bất cứ lúc nào.
-   **Quét Sơ Bộ**: Trước khi bắt đầu, công cụ tự kiểm tra danh sách ID bạn nhập và báo cáo ngay những ai đã là bạn bè.
-   **Tìm Kiếm Bền Bỉ**: Tự động nhấn "Tìm kiếm" liên tục cho mỗi ID cho đến khi tìm thấy trạng thái cuối cùng ("Thêm bạn bè", "Đã yêu cầu", "Bạn bè", v.v.).
-   **Xác Nhận Kết Quả**: Sau khi nhấn "Thêm bạn bè", công cụ sẽ chờ và kiểm tra lại để đảm bảo yêu cầu đã được gửi thành công (nút chuyển thành "Đã yêu cầu").
-   **Kiểm Tra ID Hợp Lệ**: Tự động bỏ qua các ID có định dạng không đúng.
-   **Điều Khiển Linh Hoạt**: Bắt đầu, Tạm dừng, Tiếp tục, Dừng chu trình bất cứ lúc nào.
-   **Tự Động F5 (Tùy chọn)**:
    -   Hẹn giờ tự động tải lại (F5) trang Locket sau một khoảng thời gian bạn đặt.
    -   Hiển thị đồng hồ đếm ngược trực quan.
    -   Tự động tiếp tục công việc sau khi trang đã tải lại xong.
-   **Ghi Nhớ Trạng Thái**: Lưu lại tiến trình đang chạy, ngay cả khi bạn đóng popup hoặc trình duyệt (sẽ tự động tạm dừng khi khôi phục).
-   **Nhật Ký Chi Tiết**: Ghi lại từng bước thực hiện trong quá trình tìm kiếm và kết bạn.
-   **Nút Reset**: Xóa sạch toàn bộ tiến trình, danh sách ID đã nhập và làm mới danh sách chọn nhanh.
-   **Tự Động Mở Tab**: Tự động tìm hoặc mở tab Locket khi bạn mở tiện ích.

## 🚀 Hướng Dẫn Cài Đặt

1.  **Tải xuống**: Tải về phiên bản mới nhất của tiện ích (thư mục chứa các tệp `.js`, `.html`, `.css`, `manifest.json`).
2.  **Mở trang Tiện ích**: Mở trình duyệt Chrome và truy cập `chrome://extensions`.
3.  **Bật Chế độ nhà phát triển**: Gạt bật "Chế độ dành cho nhà phát triển" (Developer mode) ở góc trên bên phải.
4.  **Tải tiện ích**: Nhấp vào nút "Tải tiện ích đã giải nén" (Load unpacked) và chọn thư mục chứa mã nguồn tiện ích bạn vừa tải.
5.  **Ghim tiện ích**: Ghim tiện ích lên thanh công cụ để dễ dàng truy cập.

## 💡 Cách Sử Dụng

1.  **Mở trang Locket & Tiện ích**: Truy cập `https://locket.binhake.dev/friends.html` và nhấp vào biểu tượng của tiện ích.
2.  **Nhập/Chọn ID**:
    -   **Nhập thủ công**: Gõ hoặc dán danh sách ID vào ô "Nhập danh sách ID" (mỗi ID một dòng).
    -   **Chọn nhanh**:
        -   Sử dụng danh sách thả xuống "Hoặc chọn nhanh ID có sẵn:" (danh sách này đã tự động loại bỏ bạn bè).
        -   Nhấn nút "Chọn tất cả" để thêm toàn bộ celeb chưa kết bạn vào ô nhập liệu.
        -   Nhấn nút "🔄" để quét lại danh sách bạn bè và làm mới danh sách chọn nhanh.
3.  **Hẹn Giờ F5 (Tùy chọn)**:
    -   Đánh dấu vào ô "Tự động F5 trang sau:".
    -   Nhập số phút mong muốn vào ô bên cạnh.
4.  Nhấn nút **Bắt đầu**.
5.  Công cụ sẽ tự động chạy. Bạn có thể theo dõi tiến trình và nhật ký trong cửa sổ tiện ích.
6.  Sử dụng các nút **Tạm dừng**, **Tiếp tục**, **Dừng** để điều khiển.
7.  Nhấn nút **Reset** để xóa mọi thứ và bắt đầu lại từ đầu.

## ❤️ Ủng Hộ Tác Giả

Nếu bạn thấy công cụ này hữu ích, hãy cân nhắc ủng hộ để tác giả có thêm động lực phát triển các dự án mới.

-   **Tác giả**: [Huy Vũ](https://beacons.ai/huyvu2512)
-   Nếu bạn thấy dự án này hữu ích, hãy để lại một ⭐ trên GitHub để ủng hộ mình nhé!

## 📄 Phiên Bản Update

- **v1.4 (Nâng cấp lớn)**: Thêm tính năng Quét sơ bộ trước khi chạy, Chọn tất cả celeb, nút Quét lại danh sách celeb, nút Reset toàn diện, sửa lỗi mất danh sách khi chuyển tab, sửa lỗi dừng hoạt động sau khi F5, tăng tốc độ và tối ưu hóa quy trình. Đổi tên và biểu tượng.
- **v1.3 (Sửa lỗi)**: Fix, sửa lỗi
- **v1.2 (Nâng cấp & Sửa lỗi)**: Thay đổi Logo, tự động mở tab mới, dừng khi tải lại trang, thêm cơ chế giám sát 5 phút chống treo và sửa lỗi đồng hồ đếm ngược.
- **v1.1 (Bổ sung tính năng)**: Thêm tính năng hẹn giờ, cải tiến giao diện và quản lý trạng thái.
- **v1.0 (Phiên bản đầu tiên)**: Ra mắt các tính năng cốt lõi: tự động kết bạn, chế độ ngẫu nhiên và xử lý lỗi kết nối.
