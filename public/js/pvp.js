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
    const findRandomBtn = document.getElementById('find-random-btn');
    const waitingMessage = document.getElementById('waiting-message');
    const playerList = document.getElementById('player-list'); 
    const searchInput = document.getElementById('search-input');
    const boardElement = document.getElementById('shared-board'), paletteElement = document.getElementById('number-palette');
    const checkBtn = document.getElementById('check-btn'), surrenderBtn = document.getElementById('surrender-btn');
    const p1Name = document.getElementById('player1-name'), p2Name = document.getElementById('player2-name');
    const p1TimeEl = document.getElementById('player1-time'), p2TimeEl = document.getElementById('player2-time');
    const chatWindow = document.getElementById('chat-window'), chatForm = document.getElementById('chat-form'), chatInput = document.getElementById('chat-input');

    // === BIẾN TRẠNG THÁI GAME ===
    let selectedCell = null, puzzle = [], myBoard = [], solution = [], myPlayerNum = 0;

    // === HÀM VẼ VÀ TIỆN ÍCH ===
    
    // HÀM: Vẽ danh sách user (NÂNG CẤP)
    function renderUserList(users) {
        playerList.innerHTML = ''; 
        users.forEach(user => {
            if (user.username === myUsername) return; // Không hiện tên mình

            const li = document.createElement('li');
            li.className = 'player-item';
            
            let statusText = '● Online';
            let statusClass = 'online';
            let isBusy = false; // Đang chơi hoặc đang tìm

            if (user.status === 'playing') {
                statusText = '● Đang chơi';
                statusClass = 'playing';
                isBusy = true;
            } else if (user.status === 'waiting') {
                statusText = '● Đang tìm...';
                statusClass = 'waiting';
                isBusy = true;
            }

            li.innerHTML = `
                <div class="avatar"></div>
                <div class="info">
                    <div class="username">${user.username}</div>
                    <div class="status ${statusClass}">${statusText}</div>
                </div>
                <button class="challenge-btn" data-username="${user.username}" ${isBusy ? 'disabled' : ''}>
                    Thách đấu
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
            const username = item.querySelector('.username').textContent.toLowerCase();
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
        for (let i = 1; i <= 9; i++) {
            const numEl = document.createElement('div');
            numEl.className = 'number'; numEl.textContent = i;
            
            numEl.addEventListener('click', () => {
                if (selectedCell) {
                    let r = parseInt(selectedCell.dataset.row);
                    let c = parseInt(selectedCell.dataset.col);
                    if (puzzle[r][c] === 0) {
                        let num = parseInt(numEl.textContent);
                        selectedCell.textContent = num;
                        selectedCell.className = 'cell my-move';
                        socket.emit('makeMove', { row: r, col: c, num: num });
                        selectedCell = null;
                    }
                }
            });
            paletteElement.appendChild(numEl);
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

    // === GỬI SỰ KIỆN LÊN SERVER ===
    
    findRandomBtn.addEventListener('click', () => {
        findRandomBtn.disabled = true;
        waitingMessage.style.display = 'block';
        socket.emit('findMatch');
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
        if (confirm("Bạn có chắc muốn đầu hàng?")) {
            socket.emit('surrender');
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

    // === SỰ KIỆN MỚI: NHẬN LỜI MỜI ===
    socket.on('receiveInvite', (data) => {
        // data = { fromUsername }
        if (confirm(`Bạn có lời mời thách đấu từ ${data.fromUsername}. Đồng ý?`)) {
            socket.emit('acceptInvite', { targetUsername: data.fromUsername });
        }
    });

    socket.on('matchFound', (data) => {
        findRandomBtn.disabled = false;
        waitingMessage.style.display = 'none';
        lobbyScreen.style.display = 'none';
        gameScreen.style.display = 'flex';
        
        puzzle = stringToBoard(data.puzzle);
        solution = stringToBoard(data.solution); 
        
        if(data.p1.username === myUsername) {
            p1Name.textContent = `Bạn (${data.p1.username})`;
            p2Name.textContent = data.p2.username;
        } else {
            p1Name.textContent = data.p1.username;
            p2Name.textContent = `Bạn (${data.p2.username})`;
        }
        createBoard();
        createPalette();
    });

    socket.on('updateTimer', (data) => {
        const minutes = Math.floor(data.timeLeft / 60);
        const seconds = data.timeLeft % 60;
        const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        p1TimeEl.textContent = timeString;
        p2TimeEl.textContent = timeString;
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
    });

    socket.on('gameAlert', (data) => {
        alert(data.message);
    });

    socket.on('gameResult', (data) => {
        let message = "";
        if (data.draw) {
            message = "Hết giờ! Trận đấu hòa!";
        } else if (data.winner === myUsername) {
            message = `Chúc mừng! Bạn đã thắng ${data.loser}!`;
        } else {
            message = `Bạn đã thua! Người thắng: ${data.winner}.`;
        }
        alert(message);
        
        gameScreen.style.display = 'none';
        lobbyScreen.style.display = 'block';
        findRandomBtn.disabled = false;
        waitingMessage.style.display = 'none';
    });
    
    socket.on('forceReload', (data) => {
        alert(data.message);
        window.location.reload();
    });
});