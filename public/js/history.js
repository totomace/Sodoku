document.addEventListener('DOMContentLoaded', async () => {
    
    // === LẤY CÁC THẺ HTML ===
    const historyList = document.getElementById('history-list');
    const historyTitle = document.getElementById('history-title'); // DÒNG MỚI
    
    // Lấy tên user đã đăng nhập (từ localStorage)
    const username = localStorage.getItem('username');

    // === GÁN TÊN USER VÀO TIÊU ĐỀ (PHẦN MỚI) ===
    if (username) {
        historyTitle.textContent = `Lịch sử của: ${username}`;
    } else {
        historyTitle.textContent = "Không tìm thấy người dùng";
    }
    // === HẾT PHẦN MỚI ===

    if (!username) {
        historyList.innerHTML = '<li>Lỗi: Bạn chưa đăng nhập (localStorage trống).</li>';
        return;
    }

    try {
        // Gọi API mới để lấy lịch sử
        // Ví dụ: /api/history/client01
        const response = await fetch(`/api/history/${username}`);
        const history = await response.json();

        if (!history.success) {
            throw new Error(history.message);
        }

        if (history.data.length === 0) {
            historyList.innerHTML = '<li>Bạn chưa chơi ván nào.</li>';
            return;
        }

        // Hiển thị lịch sử
        historyList.innerHTML = ''; // Xóa
        history.data.reverse().forEach(game => { // Đảo ngược để thấy game mới nhất
            const li = document.createElement('li');
            li.className = 'history-item';
            
            // Format ngày giờ
            const date = new Date(game.date).toLocaleString('vi-VN');
            
            // Sửa lại class (toUpperCase) để khớp CSS
            const modeClass = game.mode.toUpperCase(); 

            li.innerHTML = `
                <div>
                    <div class="mode mode-${modeClass}">
                        Chơi đơn: ${game.mode}
                    </div>
                    <div class="date">${date}</div>
                </div>
                <div class="score">${game.score} điểm</div>
            `;
            historyList.appendChild(li);
        });

    } catch (error) {
        historyList.innerHTML = `<li>Lỗi tải lịch sử: ${error.message}</li>`;
    }
});