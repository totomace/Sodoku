console.log('ĐANG CHẠY PVP.JS PHIÊN BẢN MỚI NHẤT (V15 - Mời riêng)'); 

document.addEventListener('DOMContentLoaded', () => {
    // === KẾT NỐI VÀ LẤY TÊN USER ===
    const socket = io();
    const myUsername = localStorage.getItem('username');
    if (!myUsername) {
        alert("Lỗi: Bạn chưa đăng nhập!");
        window.location.href = '/login.html';
        return;
    }

    // Kiểm tra URL có room ID không
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');

    // === DOM ELEMENTS ===
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('pvp-game-screen');
    const matchOverlay = document.getElementById('match-overlay');
    const matchStatus = document.getElementById('match-status');
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNumber = document.getElementById('countdown-number');
    const findRandomBtn = document.getElementById('find-random-btn');
    const cancelMatchBtn = document.getElementById('cancel-match-btn');
    const waitingMessage = document.getElementById('waiting-message');
    const waitingTimeEl = document.getElementById('waiting-time');
    const playerList = document.getElementById('player-list'); 
    const searchInput = document.getElementById('search-input');
    const roomIdInput = document.getElementById('room-id-input');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomIdBtn = document.getElementById('join-room-id-btn');
    const createdRoomDisplay = document.getElementById('created-room-display');
    const createdRoomId = document.getElementById('created-room-id');
    const tabChallenge = document.getElementById('tab-challenge');
    const tabRooms = document.getElementById('tab-rooms');
    const challengeContent = document.getElementById('challenge-content');
    const roomsContent = document.getElementById('rooms-content');
    const roomList = document.getElementById('room-list');
    const inviteModal = document.getElementById('invite-modal');
    const challengerNameEl = document.getElementById('challenger-name');
    const acceptInviteBtn = document.getElementById('accept-invite-btn');
    const declineInviteBtn = document.getElementById('decline-invite-btn');
    const readyModal = document.getElementById('ready-modal');
    const readyRoomId = document.getElementById('ready-room-id');
    const readyPlayer1 = document.getElementById('ready-player1');
    const readyPlayer2 = document.getElementById('ready-player2');
    const readyStatus1 = document.getElementById('ready-status1');
    const readyStatus2 = document.getElementById('ready-status2');
    const readyBtn = document.getElementById('ready-btn');
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    const surrenderModal = document.getElementById('surrender-modal');
    const confirmSurrenderBtn = document.getElementById('confirm-surrender-btn');
    const cancelSurrenderBtn = document.getElementById('cancel-surrender-btn');
    const resultModal = document.getElementById('result-modal');
    const resultBox = document.getElementById('result-box');
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultReason = document.getElementById('result-reason');
    const resultOpponent = document.getElementById('result-opponent');
    const resultScore = document.getElementById('result-score');
    const resultMistakes = document.getElementById('result-mistakes');
    const resultCloseBtn = document.getElementById('result-close-btn');
    const boardElement = document.getElementById('shared-board'), paletteElement = document.getElementById('number-palette');
    const checkBtn = document.getElementById('check-btn'), surrenderBtn = document.getElementById('surrender-btn');
    const p1Name = document.getElementById('player1-name'), p2Name = document.getElementById('player2-name');
    const p1TimeEl = document.getElementById('player1-time'), p2TimeEl = document.getElementById('player2-time');
    const p1ScoreEl = document.getElementById('player1-score'), p2ScoreEl = document.getElementById('player2-score');
    const p1MistakesEl = document.getElementById('player1-mistakes'), p2MistakesEl = document.getElementById('player2-mistakes');
    const chatWindow = document.getElementById('chat-window'), chatForm = document.getElementById('chat-form'), chatInput = document.getElementById('chat-input');

    // === BIẾN TRẠNG THÁI GAME ===
    let selectedCell = null, puzzle = [], myBoard = [], solution = [], myPlayerNum = 0;
    let gameStartTime = 0, myScore = 1000, opponentScore = 1000, myMistakes = 0, opponentMistakes = 0;
    let currentTurn = 1, turnTimeLeft = 30; // Thời gian suy nghĩ mỗi lượt
    let waitingStartTime = 0; // Thời gian bắt đầu chờ
    let waitingTimer = null; // Timer cho thời gian chờ
    let currentInviter = null; // Lưu tên người mời
    let isSpectator = false; // Chế độ xem
    let currentRoomId = null; // Phòng hiện tại
    let isWaitingInRoom = false; // Đang chờ trong phòng

    // === TAB SWITCHING ===
    tabChallenge.addEventListener('click', () => {
        // Cập nhật class
        tabChallenge.classList.add('active');
        tabRooms.classList.remove('active');
        
        // Cập nhật style cho tab Challenge (active)
        tabChallenge.style.background = 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)';
        tabChallenge.style.color = 'white';
        tabChallenge.style.borderColor = '#3498db';
        
        // Cập nhật style cho tab Rooms (inactive)
        tabRooms.style.background = 'white';
        tabRooms.style.color = '#666';
        tabRooms.style.borderColor = '#e0e0e0';
        
        // Hiển thị nội dung
        challengeContent.style.display = 'block';
        roomsContent.style.display = 'none';
    });

    tabRooms.addEventListener('click', () => {
        // Cập nhật class
        tabRooms.classList.add('active');
        tabChallenge.classList.remove('active');
        
        // Cập nhật style cho tab Rooms (active)
        tabRooms.style.background = 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)';
        tabRooms.style.color = 'white';
        tabRooms.style.borderColor = '#3498db';
        
        // Cập nhật style cho tab Challenge (inactive)
        tabChallenge.style.background = 'white';
        tabChallenge.style.color = '#666';
        tabChallenge.style.borderColor = '#e0e0e0';
        
        // Hiển thị nội dung
        roomsContent.style.display = 'block';
        challengeContent.style.display = 'none';
        socket.emit('getRoomList'); // Yêu cầu danh sách phòng
    });

    // === HÀM VẼ VÀ TIỆN ÍCH ===

    // HÀM: Hiển thị toast notification
    function showToast(message, type = 'info', title = '') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const titles = {
            success: title || 'Thành công',
            error: title || 'Lỗi',
            warning: title || 'Cảnh báo',
            info: title || 'Thông báo'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type]}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">×</button>
        `;

        toastContainer.appendChild(toast);

        // Nút đóng
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            removeToast(toast);
        });

        // Tự động đóng sau 4 giây
        setTimeout(() => {
            removeToast(toast);
        }, 4000);
    }

    function removeToast(toast) {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    // HÀM: Vẽ danh sách phòng
    function renderRoomList(rooms) {
        roomList.innerHTML = '';
        
        if (rooms.length === 0) {
            roomList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Chưa có phòng nào</p>';
            return;
        }

        rooms.forEach(room => {
            const li = document.createElement('li');
            li.className = 'room-item';

            let statusClass = 'empty';
            let statusText = 'Trống';
            let playerCount = room.playerCount || 0;
            let canJoin = true;
            let canSpectate = false;

            if (room.status === 'playing') {
                statusClass = 'playing';
                statusText = 'Đang chơi';
                canJoin = false;
                canSpectate = true;
            } else if (room.status === 'ready' || playerCount === 2) {
                statusClass = 'full';
                statusText = 'Đang chuẩn bị';
                canJoin = false;
                canSpectate = false;
            } else if (playerCount === 1) {
                statusClass = 'waiting';
                statusText = 'Chờ 1 người';
            }

            const isMyRoom = (currentRoomId === room.id);
            const spectatorInfo = room.spectatorCount > 0 ? ` 👁️ ${room.spectatorCount} người xem` : '';

            li.innerHTML = `
                <div class="room-info">
                    <div class="room-name">🏠 ${room.name} <span style="font-size: 0.8rem; color: #999;">(ID: ${room.id})</span></div>
                    <div class="room-players">
                        ${room.player1 || '...'} ${room.player2 ? 'vs ' + room.player2 : ''}${spectatorInfo}
                    </div>
                </div>
                <span class="room-status ${statusClass}">${statusText}</span>
                ${isMyRoom && isWaitingInRoom ? `<button class="room-btn" style="background: #dc3545;" data-room="${room.id}" data-action="leave">Thoát</button>` : ''}
                ${!isMyRoom && canJoin ? `<button class="room-btn join" data-room="${room.id}">Vào chơi</button>` : ''}
                ${!isMyRoom && canSpectate ? `<button class="room-btn spectate" data-room="${room.id}">👁️ Xem</button>` : ''}
                ${(room.playerCount > 0 || canSpectate) ? `<button class="room-btn" style="background: #17a2b8; padding: 8px 12px;" data-room="${room.id}" data-action="share">📋</button>` : ''}
            `;
            
            roomList.appendChild(li);
        });

        // Gán sự kiện cho các nút
        document.querySelectorAll('.room-btn.join').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = e.target.dataset.room;
                currentRoomId = roomId;
                isWaitingInRoom = true;
                socket.emit('joinRoom', { roomId });
            });
        });

        document.querySelectorAll('.room-btn[data-action="leave"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = e.target.dataset.room;
                socket.emit('leaveRoom', { roomId });
                currentRoomId = null;
                isWaitingInRoom = false;
            });
        });

        document.querySelectorAll('.room-btn.spectate').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = e.target.dataset.room;
                isSpectator = true;
                socket.emit('spectateRoom', { roomId });
            });
        });

        document.querySelectorAll('.room-btn[data-action="share"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = e.target.dataset.room;
                const roomUrl = `${window.location.origin}/pvp.html?room=${roomId}`;
                
                // Copy vào clipboard
                navigator.clipboard.writeText(roomUrl).then(() => {
                    showToast('Đã copy link phòng vào clipboard!', 'success', 'Share Link');
                }).catch(() => {
                    // Fallback nếu clipboard API không hoạt động
                    showToast(`Link: ${roomUrl}`, 'info', 'Link Phòng');
                });
            });
        });
    }
    
    // HÀM: Vẽ danh sách user (NÂNG CẤP)
    function renderUserList(users) {
        playerList.innerHTML = ''; 
        users.forEach(user => {
            if (user.username === myUsername) return; // Không hiện tên mình

            const li = document.createElement('li');
            li.className = 'player-item';
            
            let statusText = 'Online';
            let statusClass = 'online';
            let isBusy = false; // Đang chơi hoặc đang tìm

            if (user.status === 'playing') {
                statusText = 'Đang chơi';
                statusClass = 'playing';
                isBusy = true;
            } else if (user.status === 'waiting') {
                statusText = 'Đang tìm...';
                statusClass = 'waiting';
                isBusy = true;
            }

            // Lấy chữ cái đầu của username
            const initial = user.username.charAt(0).toUpperCase();

            li.innerHTML = `
                <div class="avatar">${initial}</div>
                <div class="info">
                    <div class="player-name">${user.username}</div>
                    <div class="status ${statusClass}">${statusText}</div>
                </div>
                <button class="challenge-btn" data-username="${user.username}" ${isBusy ? 'disabled' : ''}>
                    ⚔️ Thách đấu
                </button>
            `;
            playerList.appendChild(li);
        });
        
        // Gán sự kiện click cho các nút MỚI
        document.querySelectorAll('.challenge-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const targetUsername = e.target.dataset.username;
                socket.emit('privateInvite', { targetUsername: targetUsername });
                addChatMessage({ isSystem: true, message: `Đã gửi lời mời tới ${targetUsername}...`});
            });
        });
    }

    // HÀM: Lọc danh sách (client-side)
    searchInput.addEventListener('keyup', () => {
        const filter = searchInput.value.toLowerCase();
        const items = playerList.getElementsByTagName('li');
        
        Array.from(items).forEach(item => {
            const username = item.querySelector('.player-name').textContent.toLowerCase();
            if (username.includes(filter)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // (Các hàm vẽ bàn cờ, chat... giữ nguyên)
    function stringToBoard(str) {
        // Nếu đã là array thì return luôn
        if (Array.isArray(str)) {
            return str;
        }
        
        // Nếu là string thì convert
        if (typeof str === 'string') {
            let board = [];
            for (let r = 0; r < 9; r++) {
                board.push(str.substring(r*9, r*9 + 9).split('').map(Number));
            }
            return board;
        }
        
        // Fallback: tạo board trống
        console.error('Invalid puzzle format:', str);
        return Array(9).fill(0).map(() => Array(9).fill(0));
    }
    function createBoard() {
        boardElement.innerHTML = ''; 
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                let num = puzzle[r][c]; 
                if (num !== 0) {
                    cell.textContent = num;
                    cell.classList.add('given');
                } else {
                    cell.addEventListener('click', () => {
                        if (isSpectator) {
                            addChatMessage({ isSystem: true, message: '👁️ Bạn đang ở chế độ xem!' });
                            return;
                        }
                        if (selectedCell) selectedCell.classList.remove('selected');
                        selectedCell = cell;
                        selectedCell.classList.add('selected');
                    });
                }
                boardElement.appendChild(cell);
            }
        }
    }
    function createPalette() {
        paletteElement.innerHTML = '';
        
        // Tạo các nút số 1-9
        for (let i = 1; i <= 9; i++) {
            const numEl = document.createElement('div');
            numEl.className = 'number'; 
            numEl.textContent = i;
            
            numEl.addEventListener('click', () => {
                fillNumber(i);
            });
            paletteElement.appendChild(numEl);
        }
        
        // Thêm nút xóa
        const eraseEl = document.createElement('div');
        eraseEl.className = 'number erase';
        eraseEl.textContent = '✖';
        eraseEl.title = 'Xóa (Delete/Backspace)';
        eraseEl.addEventListener('click', () => {
            eraseCell();
        });
        paletteElement.appendChild(eraseEl);
    }
    
    // Hàm điền số
    function fillNumber(num) {
        if (isSpectator) {
            addChatMessage({ isSystem: true, message: '👁️ Bạn đang ở chế độ xem, không thể tương tác!' });
            return;
        }
        
        if (!selectedCell) {
            addChatMessage({ isSystem: true, message: '⚠️ Hãy chọn một ô trước!' });
            return;
        }
        
        // Kiểm tra xem có phải lượt của mình không
        if (currentTurn !== myPlayerNum) {
            addChatMessage({ isSystem: true, message: '⏸️ Chưa đến lượt của bạn!' });
            return;
        }
        
        let r = parseInt(selectedCell.dataset.row);
        let c = parseInt(selectedCell.dataset.col);
        
        if (puzzle[r][c] === 0) {
            selectedCell.textContent = num;
            selectedCell.className = 'cell my-move';
            socket.emit('makeMove', { row: r, col: c, num: num });
            selectedCell = null;
        }
    }
    
    // Hàm xóa ô
    function eraseCell() {
        if (isSpectator) {
            addChatMessage({ isSystem: true, message: '👁️ Bạn đang ở chế độ xem, không thể tương tác!' });
            return;
        }
        
        if (!selectedCell) {
            addChatMessage({ isSystem: true, message: '⚠️ Hãy chọn một ô trước!' });
            return;
        }
        
        // Kiểm tra xem có phải lượt của mình không
        if (currentTurn !== myPlayerNum) {
            addChatMessage({ isSystem: true, message: '⏸️ Chưa đến lượt của bạn!' });
            return;
        }
        
        let r = parseInt(selectedCell.dataset.row);
        let c = parseInt(selectedCell.dataset.col);
        
        if (puzzle[r][c] === 0) {
            selectedCell.textContent = '';
            selectedCell.className = 'cell';
            socket.emit('makeMove', { row: r, col: c, num: 0 });
            selectedCell = null;
        }
    }
    
    function addChatMessage(data) {
        const li = document.createElement('li');
        let strongClass = (data.username === myUsername) ? 'style="color: green;"' : '';
        let displayName = (data.username === myUsername) ? "Tôi" : data.username;

        if(data.isSystem) {
             li.innerHTML = `<i ${strongClass}>${data.message}</i>`;
        } else {
             li.innerHTML = `<strong ${strongClass}>${displayName}:</strong> ${data.message}`;
        }
        
        chatWindow.appendChild(li);
        chatWindow.scrollTop = chatWindow.scrollHeight; 
    }
    
    function calculateEstimatedScore(startingScore, mistakes) {
        const PENALTY = 100;
        return Math.max(0, startingScore - (mistakes * PENALTY));
    }
    
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    
    function updateScoreDisplay() {
        // Cảnh báo thời gian < 10s
        const player1Time = document.getElementById('player1-time');
        const player2Time = document.getElementById('player2-time');
        
        if (myPlayerNum === 1) {
            p1ScoreEl.textContent = myScore;
            p2ScoreEl.textContent = opponentScore;
            p1MistakesEl.textContent = myMistakes;
            p2MistakesEl.textContent = opponentMistakes;
            
            // Hiển thị thời gian suy nghĩ của lượt hiện tại
            if (currentTurn === 1) {
                p1TimeEl.textContent = formatTime(turnTimeLeft);
                p2TimeEl.textContent = '--:--';
                player1Time.className = turnTimeLeft <= 10 ? 'time warning' : 'time';
            } else {
                p1TimeEl.textContent = '--:--';
                p2TimeEl.textContent = formatTime(turnTimeLeft);
                player2Time.className = turnTimeLeft <= 10 ? 'time warning' : 'time';
            }
            
            // Highlight lượt chơi
            const p1Stat = document.getElementById('player1-stat');
            const p2Stat = document.getElementById('player2-stat');
            if (currentTurn === 1) {
                p1Stat.classList.add('active-turn');
                p2Stat.classList.remove('active-turn');
            } else {
                p1Stat.classList.remove('active-turn');
                p2Stat.classList.add('active-turn');
            }
        } else {
            p1ScoreEl.textContent = opponentScore;
            p2ScoreEl.textContent = myScore;
            p1MistakesEl.textContent = opponentMistakes;
            p2MistakesEl.textContent = myMistakes;
            
            // Hiển thị thời gian suy nghĩ của lượt hiện tại
            if (currentTurn === 1) {
                p1TimeEl.textContent = formatTime(turnTimeLeft);
                p2TimeEl.textContent = '--:--';
                player1Time.className = turnTimeLeft <= 10 ? 'time warning' : 'time';
            } else {
                p1TimeEl.textContent = '--:--';
                p2TimeEl.textContent = formatTime(turnTimeLeft);
                player2Time.className = turnTimeLeft <= 10 ? 'time warning' : 'time';
            }
            
            // Highlight lượt chơi
            const p1Stat = document.getElementById('player1-stat');
            const p2Stat = document.getElementById('player2-stat');
            if (currentTurn === 2) {
                p2Stat.classList.add('active-turn');
                p1Stat.classList.remove('active-turn');
            } else {
                p2Stat.classList.remove('active-turn');
                p1Stat.classList.add('active-turn');
            }
        }
    }

    // === GỬI SỰ KIỆN LÊN SERVER ===
    
    // Tạo phòng riêng với ID tùy chọn
    createRoomBtn.addEventListener('click', () => {
        // Luôn tạo ID ngẫu nhiên 4 số
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        showToast(`ID phòng: ${roomId}`, 'info', 'Đã tạo phòng');
        
        // Hiển thị ID đã tạo
        createdRoomId.textContent = roomId;
        createdRoomDisplay.style.display = 'block';
        
        // Disable các nút
        createRoomBtn.disabled = true;
        joinRoomIdBtn.disabled = true;
        roomIdInput.disabled = true;
        
        // Gửi yêu cầu tạo phòng
        socket.emit('createPrivateRoom', { roomId });
        currentRoomId = roomId;
        isWaitingInRoom = true;
    });
    
    // Tham gia phòng bằng ID
    joinRoomIdBtn.addEventListener('click', () => {
        const roomId = roomIdInput.value.trim();
        
        if (!roomId) {
            showToast('Vui lòng nhập ID phòng!', 'warning', 'Thiếu ID');
            return;
        }
        
        // Gửi yêu cầu join phòng
        socket.emit('joinPrivateRoom', { roomId });
        currentRoomId = roomId;
    });
    
    findRandomBtn.addEventListener('click', () => {
        findRandomBtn.disabled = true;
        
        // Hiện overlay tìm trận
        matchOverlay.classList.add('show');
        matchStatus.textContent = 'Đang tìm đối thủ xứng tầm...';
        
        // Hiển thị toast
        showToast('Đang tìm kiếm đối thủ cho bạn...', 'info', 'Tìm trận');
        
        // Bắt đầu đếm thời gian chờ
        waitingStartTime = Date.now();
        waitingTimeEl.textContent = '00:00';
        
        console.log('Bắt đầu đếm thời gian chờ...', waitingTimeEl);
        
        // Cập nhật thời gian mỗi giây
        waitingTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - waitingStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            const timeText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            waitingTimeEl.textContent = timeText;
            console.log('Thời gian chờ:', timeText);
        }, 1000);
        
        // Lấy settings từ localStorage (hoặc dùng mặc định)
        const settings = {
            turnTimeLimit: parseInt(localStorage.getItem('turnTimeLimit')) || 30,
            timeoutPenalty: parseInt(localStorage.getItem('timeoutPenalty')) || 50,
            mistakePenalty: parseInt(localStorage.getItem('mistakePenalty')) || 100
        };
        
        socket.emit('findMatch', settings);
    });
    
    // Nút hủy tìm trận
    cancelMatchBtn.addEventListener('click', () => {
        socket.emit('cancelMatch');
        
        // Dừng timer
        if (waitingTimer) {
            clearInterval(waitingTimer);
            waitingTimer = null;
        }
        
        matchOverlay.classList.remove('show');
        findRandomBtn.disabled = false;
        showToast('Đã hủy tìm trận', 'warning', 'Hủy tìm kiếm');
        addChatMessage({ isSystem: true, message: 'Đã hủy tìm trận.' });
    });
    
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault(); 
        const message = chatInput.value;
        if (message) {
            socket.emit('chatMessage', message); 
            chatInput.value = ''; 
        }
    });
    
    checkBtn.addEventListener('click', () => {
        socket.emit('checkGame'); 
    });

    surrenderBtn.addEventListener('click', () => {
        surrenderModal.classList.add('show');
    });
    
    // Xác nhận đầu hàng
    confirmSurrenderBtn.addEventListener('click', () => {
        socket.emit('surrender');
        surrenderModal.classList.remove('show');
    });
    
    // Hủy đầu hàng
    cancelSurrenderBtn.addEventListener('click', () => {
        surrenderModal.classList.remove('show');
    });
    
    // === XỬ LÝ BÀN PHÍM ===
    document.addEventListener('keydown', (e) => {
        // Chỉ xử lý khi đang ở màn hình game
        if (gameScreen.style.display !== 'flex') return;
        
        // Bỏ qua nếu đang focus vào input chat
        if (e.target === chatInput) return;
        
        // Phím số 1-9
        if (e.key >= '1' && e.key <= '9') {
            e.preventDefault();
            fillNumber(parseInt(e.key));
        }
        // Phím Delete hoặc Backspace để xóa
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            eraseCell();
        }
    });

    // === LẮNG NGHE SỰ KIỆN TỪ SERVER ===

    socket.on('connect', () => {
        socket.emit('registerUser', myUsername);
        addChatMessage({ isSystem: true, message: "Đã kết nối tới sảnh..." });
        
        // Nếu có roomId từ URL, tự động chuyển sang tab Phòng và join
        if (roomIdFromUrl) {
            showToast(`Đang tham gia ${roomIdFromUrl}...`, 'info', 'Tham gia phòng');
            
            // Chuyển sang tab Phòng
            tabRooms.click();
            
            // Đợi 500ms để danh sách phòng load xong rồi join
            setTimeout(() => {
                currentRoomId = roomIdFromUrl;
                isWaitingInRoom = true;
                socket.emit('joinRoom', { roomId: roomIdFromUrl });
            }, 500);
        }
    });

    socket.on('updateUserList', (userList) => {
        renderUserList(userList);
    });

    // === SỰ KIỆN: NHẬN TIN NHẮN ===
    socket.on('chatMessage', (data) => {
        addChatMessage(data);
    });

    // === SỰ KIỆN MỚI: NHẬN LỜI MỜI ===
    socket.on('receiveInvite', (data) => {
        // data = { fromUsername }
        currentInviter = data.fromUsername;
        challengerNameEl.textContent = data.fromUsername;
        inviteModal.classList.add('show');
        showToast(`${data.fromUsername} muốn thách đấu với bạn!`, 'info', 'Lời mời thách đấu');
    });

    // Nhận danh sách phòng
    socket.on('roomList', (rooms) => {
        renderRoomList(rooms);
    });

    // Phòng riêng đã được tạo
    socket.on('privateRoomCreated', (data) => {
        showToast(data.message, 'success', 'Phòng đã tạo');
        
        // Hiển thị modal ready để đợi
        readyRoomId.textContent = data.roomId;
        readyPlayer1.textContent = myUsername;
        readyPlayer2.textContent = '...';
        readyStatus1.textContent = '⏳';
        readyStatus2.textContent = '⏳';
        readyModal.style.display = 'flex';
        
        // Ẩn nút ready vì đang chờ người thứ 2
        readyBtn.style.display = 'none';
    });

    // Đã vào phòng (đang chờ)
    socket.on('joinedRoom', (data) => {
        if (data.waiting) {
            showToast('Đang chờ đối thủ vào phòng...', 'info', 'Đã vào phòng');
            socket.emit('getRoomList'); // Cập nhật lại danh sách
        }
    });

    // Đã thoát phòng
    socket.on('leftRoom', () => {
        showToast('Bạn đã rời khỏi phòng', 'success', 'Thoát phòng');
        currentRoomId = null;
        isWaitingInRoom = false;
        
        // Reset UI
        createdRoomDisplay.style.display = 'none';
        roomIdInput.style.display = 'block';
        roomIdInput.value = '';
        roomIdInput.disabled = false;
        createRoomBtn.disabled = false;
        joinRoomIdBtn.disabled = false;
        
        socket.emit('getRoomList'); // Cập nhật lại danh sách
    });

    // Lỗi
    socket.on('error', (data) => {
        showToast(data.message, 'error', 'Lỗi');
        
        // Reset UI nếu đang trong quá trình tạo/vào phòng
        if (isWaitingInRoom) {
            isWaitingInRoom = false;
            currentRoomId = null;
            
            // Reset UI phòng riêng
            createdRoomDisplay.style.display = 'none';
            roomIdInput.style.display = 'block';
            roomIdInput.disabled = false;
            createRoomBtn.disabled = false;
            joinRoomIdBtn.disabled = false;
            
            // Đóng modal ready nếu đang mở
            readyModal.style.display = 'none';
        }
        
        // Re-enable nút tìm trận random nếu bị disable
        findRandomBtn.disabled = false;
        waitingMessage.style.display = 'none';
    });

    // Phòng đã đủ 2 người - hiện modal ready
    socket.on('roomFull', (data) => {
        readyRoomId.textContent = data.roomId || currentRoomId;
        readyPlayer1.textContent = data.player1;
        readyPlayer2.textContent = data.player2;
        readyStatus1.textContent = data.player1Ready ? '✅' : '⏳';
        readyStatus2.textContent = data.player2Ready ? '✅' : '⏳';
        
        // Đảm bảo modal hiển thị
        readyModal.style.display = 'flex';
        
        // Hiện lại nút Ready và reset trạng thái
        readyBtn.style.display = 'block';
        readyBtn.disabled = false;
        readyBtn.innerHTML = '✓ Sẵn sàng';
        
        // Hiển thị toast thông báo
        showToast(`Phòng đã đủ 2 người! Đối thủ: ${data.player1 === myUsername ? data.player2 : data.player1}`, 'success', 'Phòng đã đầy');
    });

    // Cập nhật trạng thái ready
    socket.on('readyStatus', (data) => {
        readyStatus1.textContent = data.player1Ready ? '✅' : '⏳';
        readyStatus2.textContent = data.player2Ready ? '✅' : '⏳';
        if (data.player1Ready && data.player2Ready) {
            // Cả 2 đều sẵn sàng - sẽ nhận matchFound sau đó
            readyBtn.disabled = true;
            readyBtn.innerHTML = '⏳ Đang bắt đầu...';
        }
    });

    // Người chơi rời phòng trước khi ready
    socket.on('playerLeft', (data) => {
        readyModal.style.display = 'none';
        showToast(data.message, 'warning', 'Đối thủ đã rời phòng');
        readyBtn.disabled = false;
        readyBtn.innerHTML = '✓ Sẵn sàng';
    });

    // Nút sẵn sàng
    readyBtn.addEventListener('click', () => {
        socket.emit('playerReady', { roomId: currentRoomId });
        readyBtn.disabled = true;
        readyBtn.innerHTML = '✅ Đã sẵn sàng';
        showToast('Đang chờ đối thủ sẵn sàng...', 'info', 'Bạn đã sẵn sàng');
    });

    // Nút rời phòng trong modal ready - luôn có thể rời ngay cả khi đã sẵn sàng
    leaveRoomBtn.addEventListener('click', () => {
        if (currentRoomId) {
            socket.emit('leaveRoom', { roomId: currentRoomId });
            readyModal.style.display = 'none';
            readyBtn.disabled = false;
            readyBtn.innerHTML = '✓ Sẵn sàng';
            currentRoomId = null;
            isWaitingInRoom = false;
            
            // Reset UI
            createdRoomDisplay.style.display = 'none';
            roomIdInput.style.display = 'block';
            roomIdInput.value = '';
            createRoomBtn.disabled = false;
            joinRoomIdBtn.disabled = false;
        }
    });
    
    // Nút chấp nhận lời mời
    acceptInviteBtn.addEventListener('click', () => {
        if (currentInviter) {
            socket.emit('acceptInvite', { targetUsername: currentInviter });
            inviteModal.classList.remove('show');
            showToast('Đã chấp nhận lời mời', 'success', 'Chấp nhận thách đấu');
            currentInviter = null;
        }
    });
    
    // Nút từ chối lời mời
    declineInviteBtn.addEventListener('click', () => {
        inviteModal.classList.remove('show');
        if (currentInviter) {
            showToast(`Đã từ chối lời mời từ ${currentInviter}`, 'info', 'Từ chối thách đấu');
            addChatMessage({ isSystem: true, message: `Đã từ chối lời mời từ ${currentInviter}.` });
            currentInviter = null;
        }
    });

    socket.on('matchFound', (data) => {
        // Đóng ready modal nếu đang mở
        readyModal.style.display = 'none';
        readyBtn.disabled = false;
        readyBtn.innerHTML = '✓ Sẵn sàng';
        
        const opponentName = data.p1.username === myUsername ? data.p2.username : data.p1.username;
        showToast(`Đối thủ: ${opponentName}`, 'success', 'Đã tìm thấy trận!');
        
        // Dừng timer chờ
        if (waitingTimer) {
            clearInterval(waitingTimer);
            waitingTimer = null;
        }
        
        // Cập nhật status
        matchStatus.innerHTML = `✅ Đã tìm thấy trận!<br><span style="color: #667eea;">Đối thủ: ${opponentName}</span>`;
        
        // Nếu có puzzle (random match) thì khởi tạo game ngay
        if (data.puzzle && data.solution) {
            puzzle = stringToBoard(data.puzzle);
            solution = stringToBoard(data.solution);
            
            // Khởi tạo game state
            gameStartTime = Date.now();
            myScore = 1000;
            opponentScore = 1000;
            myMistakes = 0;
            opponentMistakes = 0;
            myPlayerNum = (data.p1.username === myUsername) ? 1 : 2;
            currentTurn = 1;
            turnTimeLeft = data.turnTimeLeft || 30;
            
            if(data.p1.username === myUsername) {
                p1Name.textContent = `Bạn (${data.p1.username})`;
                p2Name.textContent = data.p2.username;
            } else {
                p1Name.textContent = data.p1.username;
                p2Name.textContent = `Bạn (${data.p2.username})`;
            }
        }
        
        // Đợi 1.5s rồi đếm ngược 3-2-1
        setTimeout(() => {
            matchOverlay.classList.remove('show');
            
            // Đếm ngược
            let count = 3;
            countdownOverlay.classList.add('show');
            countdownNumber.textContent = count;
            
            const countInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    countdownNumber.textContent = count;
                    countdownNumber.style.animation = 'none';
                    setTimeout(() => {
                        countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
                    }, 10);
                } else {
                    clearInterval(countInterval);
                    countdownNumber.textContent = 'BẮT ĐẦU!';
                    countdownNumber.style.animation = 'bounceIn 0.6s ease-out';
                    
                    setTimeout(() => {
                        countdownOverlay.classList.remove('show');
                        
                        // Chuyển sang màn game với hiệu ứng
                        lobbyScreen.classList.add('fade-out');
                        setTimeout(() => {
                            lobbyScreen.style.display = 'none';
                            lobbyScreen.classList.remove('fade-out');
                            gameScreen.style.display = 'flex';
                            gameScreen.classList.add('fade-in');
                            
                            // Nếu đã có puzzle (random match), render board ngay
                            if (puzzle && solution) {
                                createBoard();
                                createPalette();
                                updateScoreDisplay();
                                
                                if(myPlayerNum === 1) {
                                    addChatMessage({ isSystem: true, message: '🎮 Lượt của bạn! Hãy đi nước đầu tiên.' });
                                } else {
                                    addChatMessage({ isSystem: true, message: '⏸️ Đối thủ đang suy nghĩ...' });
                                }
                            }
                        }, 500);
                    }, 1000);
                }
            }, 1000);
        }, 1500);
        
        findRandomBtn.disabled = false;
        waitingMessage.style.display = 'none';
    });

    // Nhận dữ liệu game và bắt đầu
    socket.on('gameStart', (data) => {
        puzzle = stringToBoard(data.puzzle);
        solution = stringToBoard(data.solution); 
        
        // Khởi tạo game
        gameStartTime = Date.now();
        myScore = 1000;
        opponentScore = 1000;
        myMistakes = 0;
        opponentMistakes = 0;
        myPlayerNum = (data.p1.username === myUsername) ? 1 : 2;
        currentTurn = 1; // Player 1 đi trước
        turnTimeLeft = data.turnTimeLeft || 30; // Thời gian lượt đầu
        
        if(data.p1.username === myUsername) {
            p1Name.textContent = `Bạn (${data.p1.username})`;
            p2Name.textContent = data.p2.username;
            addChatMessage({ isSystem: true, message: '🎮 Lượt của bạn! Hãy đi nước đầu tiên.' });
        } else {
            p1Name.textContent = data.p1.username;
            p2Name.textContent = `Bạn (${data.p2.username})`;
            addChatMessage({ isSystem: true, message: '⏸️ Đối thủ đang suy nghĩ...' });
        }
        
        createBoard();
        createPalette();
        updateScoreDisplay();
    });

    // Xem trận đấu (Spectator mode)
    socket.on('spectateStart', (data) => {
        showToast('Đang vào chế độ xem...', 'info', 'Chế độ quan sát');
        
        // Đóng overlay nếu có
        matchOverlay.classList.remove('show');
        
        // Chuyển sang màn game
        lobbyScreen.style.display = 'none';
        gameScreen.style.display = 'flex';
        
        // Lưu dữ liệu game
        isSpectator = true;
        puzzle = stringToBoard(data.puzzle);
        solution = stringToBoard(data.solution || data.puzzle);
        myPlayerNum = 0; // Spectator không phải player
        currentTurn = data.currentTurn;
        turnTimeLeft = data.turnTimeLeft;
        
        // Hiển thị tên players
        p1Name.textContent = data.p1.username;
        p2Name.textContent = data.p2.username;
        
        // Tạo board với trạng thái hiện tại từ p1Board
        if (data.p1Board) {
            puzzle = data.p1Board;
        }
        
        createBoard();
        createPalette();
        
        // Cập nhật điểm
        myScore = data.p1.score;
        opponentScore = data.p2.score;
        myMistakes = data.p1.mistakes;
        opponentMistakes = data.p2.mistakes;
        updateScoreDisplay();
        
        // Ẩn chat area
        const chatArea = document.getElementById('chat-area');
        if (chatArea) {
            chatArea.style.display = 'none';
        }
        
        // Làm mờ các nút điều khiển và palette
        checkBtn.disabled = true;
        surrenderBtn.disabled = true;
        checkBtn.style.opacity = '0.3';
        surrenderBtn.style.opacity = '0.3';
        checkBtn.style.cursor = 'not-allowed';
        surrenderBtn.style.cursor = 'not-allowed';
        
        paletteElement.style.opacity = '0.3';
        paletteElement.style.pointerEvents = 'none';
        
        // Thêm nút Thoát xem
        const exitSpectateBtn = document.createElement('button');
        exitSpectateBtn.id = 'exit-spectate-btn';
        exitSpectateBtn.innerHTML = '👁️ Thoát Xem';
        exitSpectateBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 30px;
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: bold;
            cursor: pointer;
            z-index: 1000;
            box-shadow: 0 4px 15px rgba(220, 53, 69, 0.3);
            transition: all 0.3s;
        `;
        
        exitSpectateBtn.addEventListener('click', () => {
            // Reload trang để quay về lobby
            window.location.reload();
        });
        
        document.body.appendChild(exitSpectateBtn);
        
        showToast('👁️ Chế độ xem - Nhấn "Thoát Xem" để quay lại', 'info', 'Đang xem trận đấu');
    });

    // Cập nhật đồng hồ đếm lượt
    socket.on('updateTurnTimer', (data) => {
        turnTimeLeft = data.turnTimeLeft;
        currentTurn = data.currentTurn;
        console.log('⏰ Update timer:', turnTimeLeft, 'giây, Lượt:', currentTurn);
        updateScoreDisplay();
    });
    
    socket.on('turnChanged', (data) => {
        currentTurn = data.currentTurn;
        turnTimeLeft = data.turnTimeLeft;
        
        if (currentTurn === myPlayerNum) {
            addChatMessage({ isSystem: true, message: '🎮 Đến lượt bạn!' });
        } else {
            addChatMessage({ isSystem: true, message: '⏸️ Đối thủ đang suy nghĩ...' });
        }
        
        updateScoreDisplay();
    });
    
    // Xử lý hết giờ lượt
    socket.on('turnTimeout', (data) => {
        addChatMessage({ 
            isSystem: true, 
            message: `⏰ ${data.message} Trừ ${data.penalty} điểm!` 
        });
    });

    socket.on('opponentMove', (data) => {
        const cell = boardElement.querySelector(`[data-row='${data.row}'][data-col='${data.col}']`);
        if (cell) {
            cell.textContent = data.num;
            cell.className = 'cell opponent-move';
        }
    });

    socket.on('checkResult', (data) => {
        boardElement.querySelectorAll('.cell.error').forEach(cell => {
            cell.classList.remove('error');
        });
        data.errors.forEach(coord => {
            const cell = boardElement.querySelector(`[data-row='${coord[0]}'][data-col='${coord[1]}']`);
            if (cell) {
                cell.classList.add('error');
            }
        });
        
        // Cập nhật số lần sai và điểm
        if (data.mistakes !== undefined) {
            myMistakes = data.mistakes;
            myScore = data.score || myScore;
            updateScoreDisplay();
            
            if (data.errors.length > 0) {
                addChatMessage({ 
                    isSystem: true, 
                    message: `❌ Có ${data.errors.length} lỗi! Điểm còn: ${myScore} (-${100})` 
                });
                
                // Cảnh báo nếu sắp hết điểm
                if (myScore <= 200) {
                    addChatMessage({ 
                        isSystem: true, 
                        message: `⚠️ CẢNH BÁO: Bạn chỉ còn ${myScore} điểm!` 
                    });
                }
            }
        }
    });
    
    // Nhận cập nhật điểm từ server
    socket.on('updateScores', (data) => {
        if (myPlayerNum === 1) {
            myScore = data.p1Score;
            opponentScore = data.p2Score;
            myMistakes = data.p1Mistakes;
            opponentMistakes = data.p2Mistakes;
        } else {
            myScore = data.p2Score;
            opponentScore = data.p1Score;
            myMistakes = data.p2Mistakes;
            opponentMistakes = data.p1Mistakes;
        }
        updateScoreDisplay();
    });

    socket.on('gameAlert', (data) => {
        showToast(data.message, 'info', 'Thông báo trận đấu');
    });

    socket.on('gameResult', (data) => {
        // Hiển thị modal kết quả
        if (data.draw) {
            resultBox.className = 'result-box draw';
            resultIcon.textContent = '⏱️';
            resultTitle.textContent = 'Hòa!';
            resultReason.textContent = 'Hết giờ! Trận đấu hòa!';
            resultOpponent.textContent = data.winner || 'Đối thủ';
            resultScore.textContent = myScore;
            resultMistakes.textContent = myMistakes;
        } else if (data.winner === myUsername) {
            resultBox.className = 'result-box win';
            resultIcon.textContent = '🏆';
            resultTitle.textContent = 'Chúc mừng! Bạn đã thắng!';
            resultReason.textContent = data.reason || 'Hoàn thành bảng!';
            resultOpponent.textContent = data.loser;
            resultScore.textContent = data.score;
            resultMistakes.textContent = data.winnerMistakes || 0;
        } else {
            resultBox.className = 'result-box lose';
            resultIcon.textContent = '😢';
            resultTitle.textContent = 'Bạn đã thua!';
            resultReason.textContent = data.reason || 'Đối thủ hoàn thành trước';
            resultOpponent.textContent = data.winner;
            resultScore.textContent = myScore;
            resultMistakes.textContent = data.loserMistakes || 0;
        }
        
        resultModal.classList.add('show');
    });
    
    // Nút đóng modal kết quả
    resultCloseBtn.addEventListener('click', () => {
        resultModal.classList.remove('show');
        
        // Reset game state với hiệu ứng
        gameStartTime = 0;
        myScore = 1000;
        opponentScore = 1000;
        myMistakes = 0;
        opponentMistakes = 0;
        currentRoomId = null;
        isWaitingInRoom = false;
        isSpectator = false;
        
        // Reset UI phòng riêng
        createdRoomDisplay.style.display = 'none';
        roomIdInput.style.display = 'block';
        roomIdInput.value = '';
        roomIdInput.disabled = false;
        createRoomBtn.disabled = false;
        joinRoomIdBtn.disabled = false;
        
        // Reset chat (hiện lại nếu bị ẩn do spectator)
        const chatArea = document.getElementById('chat-area');
        if (chatArea) {
            chatArea.style.display = 'flex';
        }
        
        // Reset palette và buttons
        if (paletteElement) {
            paletteElement.style.opacity = '1';
            paletteElement.style.pointerEvents = 'auto';
        }
        
        checkBtn.disabled = false;
        surrenderBtn.disabled = false;
        checkBtn.style.opacity = '1';
        surrenderBtn.style.opacity = '1';
        checkBtn.style.cursor = 'pointer';
        surrenderBtn.style.cursor = 'pointer';
        
        // Xóa nút thoát xem nếu có
        const exitSpectateBtn = document.getElementById('exit-spectate-btn');
        if (exitSpectateBtn) {
            exitSpectateBtn.remove();
        }
        
        gameScreen.classList.add('fade-out');
        setTimeout(() => {
            gameScreen.style.display = 'none';
            gameScreen.classList.remove('fade-out');
            lobbyScreen.style.display = 'block';
            lobbyScreen.classList.add('fade-in');
            findRandomBtn.disabled = false;
            waitingMessage.style.display = 'none';
        }, 500);
    });
    
    socket.on('forceReload', (data) => {
        showToast(data.message, 'warning', 'Cảnh báo hệ thống');
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    });
});