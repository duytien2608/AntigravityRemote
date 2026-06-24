# Antigravity Remote - Coding Standards & Guidelines

Tài liệu này chứa các quy tắc bắt buộc phải tuân theo mỗi khi tôi hoặc bất kỳ AI nào cập nhật mã nguồn cho dự án này.

## 1. UI/UX Guidelines (Frontend)
- **Công nghệ cốt lõi:** React + Vite. Không sử dụng Tailwind CSS, ưu tiên sử dụng Vanilla CSS trong `index.css` để dễ dàng kiểm soát các hiệu ứng vi mô (micro-animations).
- **Design System:** Tuân thủ hệ thống màu sắc Dark Mode cao cấp và Glassmorphism đã được định nghĩa. Sử dụng các class như `.glass-panel`, `.btn-primary`, `.btn-secondary`, `.input-field`.
- **Tuyệt đối KHÔNG sử dụng Icon:** Mọi giao diện phải theo phong cách tối giản (Minimalist Typographic). KHÔNG sử dụng hình ảnh Icon (kể cả SVG), KHÔNG sử dụng các biểu tượng Emoji (vd: ✨, 📁). Tất cả ý nghĩa phải được truyền đạt bằng chữ viết (Text) và nghệ thuật sắp chữ (Typography).
- **Trải nghiệm động:** Mọi thành phần tương tác phải có hiệu ứng mượt mà (chuyển động nổi lên, viền sáng lên khi focus) để bù đắp cho việc thiếu icon.

## 2. Backend & Architecture Guidelines
- **Kiến trúc Serverless:** Sử dụng hệ sinh thái Firebase (Auth, Firestore). Tránh việc tự code một Backend Server truyền thống để hệ thống gọn nhẹ và ít tốn chi phí bảo trì.
- **Bảo mật (E2EE):** Mọi Task chứa lệnh nguy hiểm gửi xuống máy cục bộ phải được thiết kế theo hướng bảo mật. Backend trên Cloud không được phép lưu trữ rõ ràng các mật khẩu hoặc chuỗi kết nối nhạy cảm.
- **Local Bridge Worker:** Luôn giữ file `index.js` của Local Worker gọn nhẹ nhất có thể, chỉ phụ thuộc vào `firebase` và thư viện có sẵn của Node.js (`fs`, `path`). Không được làm cồng kềnh Local Worker.
