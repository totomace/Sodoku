document.addEventListener('DOMContentLoaded', () => {

    // === KIỂM TRA ĐĂNG NHẬP (RẤT QUAN TRỌNG) ===
    const username = localStorage.getItem('username');
    if (!username) {
        alert("Lỗi: Bạn chưa đăng nhập. Đang chuyển về trang đăng nhập...");
        window.location.href = '/login.html';
        return; // Dừng chạy toàn bộ file game.js
    }
    // === HẾT PHẦN KIỂM TRA ===


    // === CÁC ĐỀ BÀI CHUẨN 100% ===
    const EASY_PUZZLE = [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9]
    ];
    const MEDIUM_PUZZLE = [
        [0, 0, 0, 2, 6, 0, 7, 0, 1],
        [6, 8, 0, 0, 7, 0, 0, 9, 0],
        [1, 9, 0, 0, 0, 4, 5, 0, 0],
        [8, 2, 0, 1, 0, 0, 0, 4, 0],
        [0, 0, 4, 6, 0, 2, 9, 0, 0],
        [0, 5, 0, 0, 0, 3, 0, 2, 8],
        [0, 0, 9, 3, 0, 0, 0, 7, 4],
        [0, 4, 0, 0, 5, 0, 0, 3, 6],
        [7, 0, 3, 0, 1, 8, 0, 0, 0]
    ];
    const HARD_PUZZLE = [
        [8, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 3, 6, 0, 0, 0, 0, 0],
        [0, 7, 0, 0, 9, 0, 2, 0, 0],
        [0, 5, 0, 0, 0, 7, 0, 0, 0],
        [0, 0, 0, 0, 4, 5, 7, 0, 0],
        [0, 0, 0, 1, 0, 0, 0, 3, 0],
        [0, 0, 1, 0, 0, 0, 0, 6, 8],
        [0, 0, 8, 5, 0, 0, 0, 1, 0],
        [0, 9, 0, 0, 0, 0, 4, 0, 0]
    ];
    // === HẾT PHẦN ĐỀ BÀI ===

    // --- LẤY DOM ELEMENTS ---
    const difficultyScreen = document.getElementById('difficulty-screen');
    const gameScreen = document.getElementById('game-screen');
    const easyBtn = document.getElementById('btn-easy');
    const mediumBtn = document.getElementById('btn-medium');
    const hardBtn = document.getElementById('btn-hard');
    const boardElement = document.getElementById('sudoku-board');
    const paletteElement = document.getElementById('number-palette');
    const solveBtn = document.getElementById('solve-btn');
    const checkBtn = document.getElementById('check-btn');
    const quitBtn = document.getElementById('quit-btn');
    const timerElement = document.getElementById('timer');
    const scoreElement = document.getElementById('score');

    // --- BIẾN TRẠNG THÁI GAME ---
    let selectedCell = null, puzzle = [], userBoard = [], solution = [];
    let timerInterval = null, timeLeft = 0, currentScore = 0;
    let currentMode = ""; 
    let gameInProgress = false; 

    // --- GẮN SỰ KIỆN ---
    easyBtn.addEventListener('click', () => startGame(EASY_PUZZLE, 1200, "Dễ")); 
    mediumBtn.addEventListener('click', () => startGame(MEDIUM_PUZZLE, 600, "Thường"));
    hardBtn.addEventListener('click', () => startGame(HARD_PUZZLE, 300, "Khó"));
    
    quitBtn.addEventListener('click', () => {
        if (gameInProgress) {
            if (confirm("Bạn có chắc muốn thoát? Tiến trình sẽ không được lưu.")) {
                stopTimer();
                gameInProgress = false;
                window.location.href = '/index.html'; 
            }
        } else {
            window.location.href = '/index.html'; 
        }
    });

    // --- HÀM BẮT ĐẦU GAME ---
    function startGame(newPuzzle, timeLimitInSeconds, mode) {
        gameInProgress = true;
        currentMode = mode;
        difficultyScreen.style.display = 'none';
        gameScreen.style.display = 'flex';
        puzzle = newPuzzle.map(row => [...row]);
        userBoard = newPuzzle.map(row => [...row]);
        
        let puzzleForSolving = newPuzzle.map(row => [...row]);
        if (solveSudoku(puzzleForSolving)) {
            solution = puzzleForSolving;
            console.log("Đã tìm thấy lời giải!"); 
        } else {
            solution = null; 
            console.error("LỖI: BỘ GIẢI KHÔNG TÌM THẤY LỜI GIẢI!");
        }
        
        currentScore = 5000;
        scoreElement.textContent = currentScore;
        startTimer(timeLimitInSeconds);
        createBoard();
    }
    
    // --- CÁC HÀM TIỆN ÍCH ---
    function startTimer(duration) {
        stopTimer();
        timeLeft = duration;
        timerElement.textContent = `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`;
        timerInterval = setInterval(() => {
            timeLeft--;
            timerElement.textContent = `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`;
            if (timeLeft <= 0) {
                stopTimer();
                gameInProgress = false;
                alert("Hết giờ! Bạn đã thua.");
                saveGameResult(0); 
                solveBtn.click();
            }
        }, 1000);
    }

    function stopTimer() { clearInterval(timerInterval); }
    function updateScore(points) {
        currentScore = Math.max(0, currentScore + points);
        scoreElement.textContent = currentScore;
    }

    async function saveGameResult(score) {
        // Lấy username từ biến chúng ta đã check ở đầu file
        if (!username || !currentMode) return; 
        try {
            await fetch('/api/save-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    mode: currentMode,
                    score: score
                })
            });
        } catch (error) {
            console.error("Lỗi lưu game:", error);
        }
    }

    // --- CÁC HÀM TẠO GIAO DIỆN ---
    function createBoard() {
        boardElement.innerHTML = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r; cell.dataset.col = c;
                let num = userBoard[r][c];
                if (num !== 0) {
                    cell.textContent = num;
                    cell.classList.add(puzzle[r][c] !== 0 ? 'given' : 'correct');
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
                if (selectedCell && gameInProgress) {
                    let r = parseInt(selectedCell.dataset.row);
                    let c = parseInt(selectedCell.dataset.col);
                    if (puzzle[r][c] === 0) {
                        userBoard[r][c] = i;
                        selectedCell.textContent = i;
                        selectedCell.classList.remove('selected', 'error');
                        selectedCell.classList.add('correct');
                        selectedCell = null;
                        updateScore(-10);
                    }
                }
            });
            paletteElement.appendChild(numEl);
        }
        const eraseBtn = document.createElement('div');
        eraseBtn.className = 'number'; eraseBtn.textContent = 'X';
        eraseBtn.addEventListener('click', () => {
             if (selectedCell && gameInProgress) {
                let r = parseInt(selectedCell.dataset.row);
                let c = parseInt(selectedCell.dataset.col);
                if (puzzle[r][c] === 0) {
                    userBoard[r][c] = 0;
                    selectedCell.textContent = '';
                    selectedCell.classList.remove('error', 'correct');
                }
             }
        });
        paletteElement.appendChild(eraseBtn);
    }

    // --- LOGIC NÚT BẤM (DÙNG ALERT) ---
    checkBtn.addEventListener('click', () => {
        if (!solution || !gameInProgress) return; 
        let isWin = true, errorsFound = false;
        
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (puzzle[r][c] === 0) { 
                    const cell = boardElement.querySelector(`[data-row='${r}'][data-col='${c}']`);
                    cell.classList.remove('error'); 
                    if (userBoard[r][c] !== 0) { 
                        if (userBoard[r][c] !== solution[r][c]) {
                            cell.classList.add('error'); 
                            isWin = false; errorsFound = true;
                        }
                    } else { isWin = false; }
                }
            }
        }
        
        if (errorsFound) {
            updateScore(-250);
        } else if (isWin) {
            stopTimer();
            gameInProgress = false;
            let timeBonus = timeLeft * 10;
            updateScore(timeBonus);
            alert(`Thắng! Điểm: ${currentScore} (Thưởng: +${timeBonus})`);
            saveGameResult(currentScore); 
        } else {
             // Im lặng
        }
    });

    solveBtn.addEventListener('click', () => {
        if (!solution || !gameInProgress) return;
        stopTimer();
        gameInProgress = false;
        userBoard = solution.map(row => [...row]);
        createBoard();
        updateScore(-currentScore);
        alert("Bạn đã xem lời giải. Điểm: 0");
        saveGameResult(0); 
    });

    // --- BỘ NÃO SUDOKU (isValid ĐÃ SỬA) ---
    function findEmptyCell(board) {
        for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (board[r][c] === 0) return { row: r, col: c };
        return null; 
    }
    
    function isValid(board, row, col, num) {
        for (let c_i = 0; c_i < 9; c_i++) {
            if (board[row][c_i] === num) return false;
        }
        for (let r_i = 0; r_i < 9; r_i++) {
            if (board[r_i][col] === num) return false;
        }
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let r_i = startRow; r_i < startRow + 3; r_i++) {
            for (let c_i = startCol; c_i < startCol + 3; c_i++) {
                if (board[r_i][c_i] === num) return false;
            }
        }
        return true;
    }

    function solveSudoku(board) {
        const emptyCell = findEmptyCell(board);
        if (!emptyCell) return true; 
        const { row, col } = emptyCell;
        for (let num = 1; num <= 9; num++) {
            if (isValid(board, row, col, num)) {
                board[row][col] = num; 
                if (solveSudoku(board)) return true; 
                board[row][col] = 0; // Backtrack
            }
        }
        return false;
    }
    
    // --- KHỞI ĐỘNG ---
    createPalette();
});