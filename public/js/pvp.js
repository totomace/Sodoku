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
    const inviteModal = document.getElementById('invite-modal');
    const challengerNameEl = document.getElementById('challenger-name');
    const acceptInviteBtn = document.getElementById('accept-invite-btn');
    const declineInviteBtn = document.getElementById('decline-invite-btn');
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

    // === HÀM VẼ VÀ TIỆN ÍCH ===
    
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
        let board = [];
        for (let r = 0; r < 9; r++) {
            board.push(str.substring(r*9, r*9 + 9).split('').map(Number));
        }
        return board;
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
    
    findRandomBtn.addEventListener('click', () => {
        findRandomBtn.disabled = true;
        
        // Hiện overlay tìm trận
        matchOverlay.classList.add('show');
        matchStatus.textContent = 'Đang tìm đối thủ xứng tầm...';
        
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
    });
    
    // Nút chấp nhận lời mời
    acceptInviteBtn.addEventListener('click', () => {
        if (currentInviter) {
            socket.emit('acceptInvite', { targetUsername: currentInviter });
            inviteModal.classList.remove('show');
            currentInviter = null;
        }
    });
    
    // Nút từ chối lời mời
    declineInviteBtn.addEventListener('click', () => {
        inviteModal.classList.remove('show');
        if (currentInviter) {
            addChatMessage({ isSystem: true, message: `Đã từ chối lời mời từ ${currentInviter}.` });
            currentInviter = null;
        }
    });

    socket.on('matchFound', (data) => {
        // Dừng timer chờ
        if (waitingTimer) {
            clearInterval(waitingTimer);
            waitingTimer = null;
        }
        
        // Cập nhật status
        matchStatus.innerHTML = `✅ Đã tìm thấy trận!<br><span style="color: #667eea;">Đối thủ: ${data.p1.username === myUsername ? data.p2.username : data.p1.username}</span>`;
        
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
                        }, 500);
                    }, 1000);
                }
            }, 1000);
        }, 1500);
        
        findRandomBtn.disabled = false;
        waitingMessage.style.display = 'none';
        
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
        alert(data.message);
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
        alert(data.message);
        window.location.reload();
    });
});