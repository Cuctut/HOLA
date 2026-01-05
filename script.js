"use strict";

/**
 * 游戏常量与配置
 */
const LETTERS = ['H', 'O', 'L', 'A'];
const EMPTY = '';
const SIZE = 4;
const BLOCK_SIZE = 2;
const MAX_HINTS = 999;

/**
 * 数独核心算法模块
 */
const SudokuCore = {
    /**
     * 检查放置是否有效
     * @param {Array} board 数独板
     * @param {number} row 行索引
     * @param {number} col 列索引
     * @param {string} val 值
     * @returns {boolean} 是否有效
     */
    isValid(board, row, col, val) {
        // 检查行
        for (let c = 0; c < SIZE; c++) {
            if (board[row][c] === val && c !== col) return false;
        }
        // 检查列
        for (let r = 0; r < SIZE; r++) {
            if (board[r][col] === val && r !== row) return false;
        }
        // 检查宫
        const startRow = Math.floor(row / BLOCK_SIZE) * BLOCK_SIZE;
        const startCol = Math.floor(col / BLOCK_SIZE) * BLOCK_SIZE;
        for (let r = 0; r < BLOCK_SIZE; r++) {
            for (let c = 0; c < BLOCK_SIZE; c++) {
                if (board[startRow + r][startCol + c] === val && (startRow + r !== row || startCol + c !== col)) return false;
            }
        }
        return true;
    },

    /**
     * 使用回溯法求解数独
     * @param {Array} board 数独板
     * @param {boolean} randomized 是否随机尝试顺序
     * @returns {boolean} 是否有解
     */
    solve(board, randomized = false) {
        for (let row = 0; row < SIZE; row++) {
            for (let col = 0; col < SIZE; col++) {
                if (board[row][col] === EMPTY) {
                    let candidates = [...LETTERS];
                    if (randomized) {
                        // 随机打乱候选词顺序
                        for (let i = candidates.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                        }
                    }

                    for (const val of candidates) {
                        if (this.isValid(board, row, col, val)) {
                            board[row][col] = val;
                            if (this.solve(board, randomized)) return true;
                            board[row][col] = EMPTY;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    },

    /**
     * 统计解的数量（用于唯一解验证）
     * @param {Array} board 数独板
     * @returns {number} 解的数量
     */
    countSolutions(board) {
        let count = 0;
        
        function solveInternal(currentBoard) {
            for (let row = 0; row < SIZE; row++) {
                for (let col = 0; col < SIZE; col++) {
                    if (currentBoard[row][col] === EMPTY) {
                        for (const val of LETTERS) {
                            if (SudokuCore.isValid(currentBoard, row, col, val)) {
                                currentBoard[row][col] = val;
                                solveInternal(currentBoard);
                                currentBoard[row][col] = EMPTY;
                                if (count > 1) return; // 剪枝：如果已经超过1个解，不需要继续
                            }
                        }
                        return;
                    }
                }
            }
            count++;
        }

        solveInternal(JSON.parse(JSON.stringify(board))); // 使用副本
        return count;
    },

    /**
     * 生成完整数独板
     * @returns {Array} 完整数独
     */
    generateFullBoard() {
        const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
        this.solve(board, true); // 使用随机化求解直接生成
        return board;
    },

    /**
     * 生成游戏谜题
     * @param {number} clues 提示数 (保留的数字)
     * @returns {Object} { puzzle, solution }
     */
    generatePuzzle(minClues = 6, maxClues = 8) {
        const solution = this.generateFullBoard();
        const puzzle = JSON.parse(JSON.stringify(solution));
        
        // 尝试挖洞
        const attempts = SIZE * SIZE; 
        let cellsToRemove = (SIZE * SIZE) - (Math.floor(Math.random() * (maxClues - minClues + 1)) + minClues);
        
        const positions = [];
        for(let r=0; r<SIZE; r++) for(let c=0; c<SIZE; c++) positions.push([r,c]);
        
        // 随机打乱位置
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        for (const [r, c] of positions) {
            if (cellsToRemove <= 0) break;
            
            const backup = puzzle[r][c];
            puzzle[r][c] = EMPTY;
            
            // 验证是否唯一解
            const solutions = this.countSolutions(puzzle);
            if (solutions !== 1) {
                puzzle[r][c] = backup; // 还原，不能挖
            } else {
                cellsToRemove--;
            }
        }

        return { puzzle, solution };
    }
};

/**
 * 游戏状态管理
 */
const GameManager = {
    puzzle: [],
    solution: [],
    userGrid: [],
    timerInterval: null,
    seconds: 0,
    selectedCell: null, // {row, col}
    hintsLeft: MAX_HINTS,
    
    init() {
        this.loadBestScore();
        this.loadHints();
        this.initGame();
        
        // 事件监听
        document.getElementById('btn-new-game').addEventListener('click', () => this.initGame());
        document.getElementById('btn-hint').addEventListener('click', () => this.useHint());
        
        // 教程相关事件
        document.getElementById('btn-tutorial').addEventListener('click', () => {
            document.getElementById('tutorial-modal').style.display = 'flex';
        });
        document.getElementById('btn-close-tutorial').addEventListener('click', () => {
            document.getElementById('tutorial-modal').style.display = 'none';
        });
        document.getElementById('tutorial-modal').addEventListener('click', (e) => {
            if (e.target.id === 'tutorial-modal') {
                e.target.style.display = 'none';
            }
        });

        document.getElementById('btn-restart').addEventListener('click', () => {
            this.initGame();
            document.getElementById('win-modal').style.display = 'none';
        });
    },

    initGame() {
        // 生成新游戏
        const gameData = SudokuCore.generatePuzzle();
        this.puzzle = gameData.puzzle;
        this.solution = gameData.solution;
        // 深拷贝puzzle到userGrid
        this.userGrid = JSON.parse(JSON.stringify(this.puzzle));
        
        this.selectedCell = null;
        this.stopTimer();
        this.startTimer();
        
        UIManager.renderGrid(this.puzzle, this.userGrid);
        UIManager.updateHintDisplay(this.hintsLeft);
        
        // 检查是否完成（理论上刚生成不会完成）
    },

    startTimer() {
        this.seconds = 0;
        UIManager.updateTimer(0);
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.seconds++;
            UIManager.updateTimer(this.seconds);
        }, 1000);
    },

    stopTimer() {
        clearInterval(this.timerInterval);
    },

    handleInput(val) {
        if (!this.selectedCell) return;
        
        const { row, col } = this.selectedCell;
        
        // 如果是预设数字，不可修改
        if (this.puzzle[row][col] !== EMPTY) return;

        // 更新用户网格
        this.userGrid[row][col] = val;
        
        // 渲染更新
        UIManager.updateCell(row, col, val);
        
        // 冲突检测与反馈
        if (val !== EMPTY) {
            const isValid = SudokuCore.isValid(this.userGrid, row, col, val);
            if (!isValid) {
                // 播放错误动画并震动
                UIManager.triggerShake(row, col);
                if ('vibrate' in navigator) navigator.vibrate(200);
            }
        }

        // 检查是否完成
        if (this.checkWin()) {
            this.gameWon();
        }
    },

    checkWin() {
        for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
                if (this.userGrid[r][c] !== this.solution[r][c]) return false;
            }
        }
        return true;
    },

    gameWon() {
        this.stopTimer();
        this.saveBestScore(this.seconds);
        UIManager.showWinModal(this.seconds);
        UIManager.startConfetti();
    },

    useHint() {
        if (this.hintsLeft <= 0) {
            alert('今日提示次数已用完');
            return;
        }
        
        // 找一个空格子
        const emptyCells = [];
        for(let r=0; r<SIZE; r++) {
            for(let c=0; c<SIZE; c++) {
                if (this.userGrid[r][c] === EMPTY) {
                    emptyCells.push({r, c});
                }
            }
        }
        
        if (emptyCells.length === 0) return;
        
        const rand = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const val = this.solution[rand.r][rand.c];
        
        this.selectedCell = { row: rand.r, col: rand.c };
        this.handleInput(val);
        // 也可以把这个格子锁死当作题面，这里简单处理为填入正确答案
        
        this.hintsLeft--;
        this.saveHints();
        UIManager.updateHintDisplay(this.hintsLeft);
    },

    saveBestScore(time) {
        const currentBest = localStorage.getItem('hola_sudoku_best');
        if (!currentBest || time < parseInt(currentBest)) {
            localStorage.setItem('hola_sudoku_best', time);
            this.loadBestScore();
        }
    },

    loadBestScore() {
        const best = localStorage.getItem('hola_sudoku_best');
        UIManager.updateBestScore(best);
    },
    
    saveHints() {
        const today = new Date().toDateString();
        localStorage.setItem('hola_hints', JSON.stringify({
            date: today,
            count: this.hintsLeft
        }));
    },
    
    loadHints() {
        const saved = JSON.parse(localStorage.getItem('hola_hints'));
        const today = new Date().toDateString();
        
        if (saved && saved.date === today) {
            this.hintsLeft = saved.count;
        } else {
            this.hintsLeft = MAX_HINTS;
            this.saveHints();
        }
    }
};

/**
 * UI 交互与渲染
 */
const UIManager = {
    gridEl: document.getElementById('grid'),
    timerEl: document.getElementById('timer'),
    bestScoreEl: document.getElementById('best-score'),
    
    renderGrid(puzzle, userGrid) {
        this.gridEl.innerHTML = '';
        
        // 创建4个Block
        for(let br = 0; br < 2; br++) {
            for (let bc = 0; bc < 2; bc++) {
                const blockEl = document.createElement('div');
                blockEl.className = 'block';
                const blockIndex = br * 2 + bc;
                const logoEl = document.createElement('div');
                logoEl.className = 'block-logo';
                const logoImg = document.createElement('img');
                let logoSrc = 'assets/HOLA_logo_1x1.jpg';
                if (blockIndex === 1) {
                    logoSrc = 'assets/whisky.png';
                } else if (blockIndex === 2) {
                    logoSrc = 'assets/cigars.png';
                }
                logoImg.alt = 'HOLA';
                blockEl.appendChild(logoEl);
                let attached = false;
                const startLogo = (useFallback = false) => {
                    if (attached) return;
                    attached = true;
                    logoImg.src = useFallback ? 'assets/HOLA_logo_1x1.jpg' : logoSrc;
                    logoEl.appendChild(logoImg);
                    logoEl.style.animation = 'logoPop 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both, logoExit 900ms cubic-bezier(0.4, 0, 0.2, 1) forwards';
                    logoEl.style.animationDelay = `0ms, ${800 + blockIndex * 180}ms`;
                };
                const preload = new Image();
                preload.src = logoSrc;
                if (typeof preload.decode === 'function') {
                    preload.decode().then(() => startLogo(false)).catch(() => startLogo(true));
                } else {
                    preload.onload = () => startLogo(false);
                    preload.onerror = () => startLogo(true);
                }
                setTimeout(() => startLogo(false), 2000);
                
                // 每个Block里有4个Cell
                for (let r = 0; r < 2; r++) {
                    for (let c = 0; c < 2; c++) {
                        const globalRow = br * 2 + r;
                        const globalCol = bc * 2 + c;
                        const cellVal = userGrid[globalRow][globalCol];
                        const isFixed = puzzle[globalRow][globalCol] !== EMPTY;
                        
                        const cellEl = document.createElement('div');
                        cellEl.className = `cell ${isFixed ? 'fixed' : ''} color-${cellVal}`;
                        cellEl.dataset.row = globalRow;
                        cellEl.dataset.col = globalCol;
                        cellEl.textContent = cellVal;
                        cellEl.style.visibility = 'hidden';
                        cellEl.addEventListener('click', (e) => {
                            this.selectCell(globalRow, globalCol);
                        });
                        
                        blockEl.appendChild(cellEl);
                    }
                }
                logoEl.addEventListener('animationend', (e) => {
                    if (e.animationName !== 'logoExit') return;
                    blockEl.querySelectorAll('.cell').forEach(cell => {
                        const r = parseInt(cell.dataset.row, 10);
                        const c = parseInt(cell.dataset.col, 10);
                        cell.style.visibility = 'visible';
                        cell.classList.add('pop-in');
                        cell.style.animationDelay = `${(r * SIZE + c) * 40}ms`;
                    });
                    logoEl.remove();
                });
                this.gridEl.appendChild(blockEl);
            }
        }
    },
    
    updateCell(row, col, val) {
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.textContent = val;
            cell.classList.remove('error');
            cell.className = cell.className.replace(/color-[HOLA]/, '');
            if (val) cell.classList.add(`color-${val}`);
            
            // 重新高亮相同数字
            this.highlightSame(val);
        }
    },
    
    selectCell(row, col) {
        GameManager.selectedCell = { row, col };
        
        // 清除之前的选择
        document.querySelectorAll('.cell.selected').forEach(el => el.classList.remove('selected'));
        
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.add('selected');
            const val = GameManager.userGrid[row][col];
            this.highlightSame(val);
        }
    },
    
    highlightSame(val) {
        document.querySelectorAll('.cell.highlight').forEach(el => el.classList.remove('highlight'));
        if (!val) return;
        
        document.querySelectorAll('.cell').forEach(el => {
            if (el.textContent === val && !el.classList.contains('selected')) {
                el.classList.add('highlight');
            }
        });
    },
    
    triggerShake(row, col) {
        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.remove('error');
            void cell.offsetWidth; // trigger reflow
            cell.classList.add('error');
        }
    },
    
    updateTimer(seconds) {
        const min = Math.floor(seconds / 60).toString().padStart(2, '0');
        const sec = (seconds % 60).toString().padStart(2, '0');
        this.timerEl.textContent = `${min}:${sec}`;
    },
    
    updateBestScore(seconds) {
        if (seconds) {
            const min = Math.floor(seconds / 60).toString().padStart(2, '0');
            const sec = (seconds % 60).toString().padStart(2, '0');
            this.bestScoreEl.textContent = `最佳: ${min}:${sec}`;
        } else {
            this.bestScoreEl.textContent = `最佳: --:--`;
        }
    },
    
    updateHintDisplay(count) {
        document.getElementById('hint-count').textContent = count;
    },
    
    showWinModal(seconds) {
        const min = Math.floor(seconds / 60).toString().padStart(2, '0');
        const sec = (seconds % 60).toString().padStart(2, '0');
        document.getElementById('final-time').textContent = `${min}:${sec}`;
        document.getElementById('win-modal').style.display = 'flex';
    },
    
    startConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const particles = [];
        const colors = ['#FF6B6B', '#4D96FF', '#FFD93D', '#6BCB77'];
        
        for(let i=0; i<150; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 10 + 5,
                speedY: Math.random() * 3 + 2,
                speedX: Math.random() * 2 - 1,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 10 - 5
            });
        }
        
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = false;
            
            particles.forEach(p => {
                p.y += p.speedY;
                p.x += p.speedX;
                p.rotation += p.rotationSpeed;
                
                if (p.y < canvas.height) active = true;
                
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
                ctx.restore();
            });
            
            if (active) requestAnimationFrame(animate);
            else ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        animate();
    }
};

// 输入面板事件
document.querySelectorAll('.input-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const val = e.currentTarget.dataset.val;
        GameManager.handleInput(val);
    });
});

// 初始化
window.addEventListener('DOMContentLoaded', () => {
    GameManager.init();
});
