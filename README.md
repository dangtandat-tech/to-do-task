# Atelier — Personal Task & Schedule Planner

Web app quản lý công việc cá nhân: Project → Task → Subtask, ưu tiên theo ma trận Eisenhower,
lịch tuần + timeline ngày kiểu Google Calendar, kéo thả để xếp lịch, board cảnh báo quá tải
thời gian. React + Vite + TypeScript, dữ liệu lưu trên Supabase (Postgres + Auth), deploy
GitHub Pages.

## 1. Cài đặt Supabase (một lần, ~5 phút)

1. Tạo tài khoản miễn phí tại [supabase.com](https://supabase.com) → **New project**
   (chọn region gần bạn, ví dụ Singapore).
2. Mở **SQL Editor** → dán toàn bộ nội dung file
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → **Run**.
3. Vào **Project Settings → API**, copy 2 giá trị:
   - `Project URL`
   - `anon public` key
4. Tạo file `.env.local` ở gốc dự án (copy từ `.env.example`) và điền 2 giá trị trên.

> Gợi ý: nếu muốn đăng ký không cần xác nhận email, vào
> **Authentication → Providers → Email** và tắt "Confirm email".

## 2. Chạy local

```bash
npm install
npm run dev
```

Mở http://localhost:5173 — đăng ký tài khoản rồi dùng.

## 3. Deploy lên GitHub Pages

1. Tạo repo GitHub, push code lên nhánh `main`.
2. Repo → **Settings → Secrets and variables → Actions** → thêm 2 secret:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Repo → **Settings → Pages** → Source: **GitHub Actions**.
4. Push bất kỳ commit nào lên `main` — workflow `.github/workflows/deploy.yml` tự build và
   deploy. Web sẽ ở `https://<username>.github.io/<repo-name>/`.

Anon key để công khai được — bảo mật thật nằm ở Row Level Security trong database
(mỗi người dùng chỉ đọc/ghi được dữ liệu của chính mình).

## Cách dùng nhanh

- **Projects**: tạo project → thêm task (nút +) → thêm subtask (nút + trên task).
  Task có subtask chỉ hoàn thành được khi mọi subtask đã xong.
- **Lên lịch**: bấm biểu tượng lịch trên task/subtask → chọn ngày (chọn nhiều ngày =
  một kế hoạch trải nhiều ngày), giờ bắt đầu, thời lượng. Trên desktop có thể kéo task
  từ cột Projects thả thẳng vào timeline.
- **Planner**: dải tuần ở trên, tap ngày để xem. Kéo block dọc timeline để đổi giờ,
  kéo vào ô ngày để đổi ngày (trên điện thoại: giữ ~0,2s rồi kéo). Tap block để sửa
  thời lượng, đánh dấu xong, hoặc xoá kế hoạch.
- **Time budget**: bảng trên timeline cộng giờ đã xếp theo 4 nhóm ưu tiên; vượt ngưỡng
  (mặc định 8h/ngày, chỉnh trong Settings) sẽ báo đỏ và chấm cảnh báo trên ô ngày.

## Tự động thông minh

- **Lịch Auto**: khi lên lịch chỉ cần chọn ngày — thời gian ước tính được chia đều
  cho các ngày (làm tròn 15') và mỗi block tự rơi vào khe trống đầu tiên của ngày đó,
  không đè lên việc đã xếp. Chọn "Custom" nếu muốn tự đặt giờ.
- **Leo thang ưu tiên**: việc *Important* còn ≤2 ngày đến hạn tự được đối xử như
  *Urgent & Important*; việc *Neither* thành *Urgent*. Hiển thị mũi tên ↑ đỏ, và board
  Time budget cũng cộng theo mức đã leo thang. Ưu tiên gốc trong database không đổi.
- **Task cha tự theo subtask**: thời gian ước tính của task cha = tổng các subtask
  chưa xong; hạn hiển thị = hạn muộn nhất của subtask (nếu cha không tự đặt hạn);
  chỉ hoàn thành được khi mọi subtask đã xong.

- **Đồng hồ tập trung + % hoàn thành**: bấm ▶ trên task để bắt đầu bấm giờ — thanh
  timer hiện cố định dưới màn hình, đi theo mọi trang, tắt mở lại vẫn chạy tiếp.
  Bấm ■ để dừng (giờ được cộng vào "đã làm"), bấm ✓ để dừng + hoàn thành luôn.
  % hoàn thành tự tính: task lẻ = giờ đã làm / ước tính; task cha = tỷ trọng các
  subtask đã xong. Không phải nhập % tay.
- **Zoom timeline**: nút −/+ trên góc phải timeline để co dãn thang giờ; block ngắn
  tự rút gọn hiển thị để không đè chữ.

## Lưu ý

- Supabase free tier tạm dừng project sau ~1 tuần không dùng — vào dashboard bấm
  **Restore** là chạy lại.
- Lịch lưu theo ngày + phút địa phương (không dùng timezone) nên đổi múi giờ không làm
  lệch block.
