// ---------- Setup ----------

const UNICODE = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};

const boardEl = document.getElementById("board");
const turnTextEl = document.getElementById("turnText");
const turnSwatchEl = document.getElementById("turnSwatch");
const messageEl = document.getElementById("message");
const resetBtn = document.getElementById("resetBtn");

let board = [];        // 8x8 array of {type, color} or null. board[0] = rank 8 (black back rank)
let currentTurn = "w";
let selected = null;    // {row, col}
let legalMoves = [];    // list of {row, col, isCapture}
let gameOver = false;

function createInitialBoard() {
    const backRank = ["r", "n", "b", "q", "k", "b", "n", "r"];
    const newBoard = new Array(8).fill(null).map(() => new Array(8).fill(null));

    for (let col = 0; col < 8; col++) {
        newBoard[0][col] = { type: backRank[col], color: "b" };
        newBoard[1][col] = { type: "p", color: "b" };
        newBoard[6][col] = { type: "p", color: "w" };
        newBoard[7][col] = { type: backRank[col], color: "w" };
    }
    return newBoard;
}

// ---------- Helpers ----------

function isOnBoard(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function pieceAt(b, row, col) {
    return isOnBoard(row, col) ? b[row][col] : null;
}

function cloneBoard(b) {
    return b.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function findKing(b, color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p && p.type === "k" && p.color === color) return { row: r, col: c };
        }
    }
    return null;
}

// ---------- Movement generation (pseudo-legal, i.e. ignoring whether it leaves own king in check) ----------

function slidingMoves(b, row, col, color, directions) {
    const moves = [];
    for (const [dr, dc] of directions) {
        let r = row + dr, c = col + dc;
        while (isOnBoard(r, c)) {
            const target = b[r][c];
            if (!target) {
                moves.push({ row: r, col: c, isCapture: false });
            } else {
                if (target.color !== color) moves.push({ row: r, col: c, isCapture: true });
                break;
            }
            r += dr;
            c += dc;
        }
    }
    return moves;
}

function pseudoMoves(b, row, col) {
    const piece = b[row][col];
    if (!piece) return [];
    const { type, color } = piece;
    const moves = [];

    if (type === "p") {
        const dir = color === "w" ? -1 : 1;
        const startRow = color === "w" ? 6 : 1;

        // forward move
        if (isOnBoard(row + dir, col) && !b[row + dir][col]) {
            moves.push({ row: row + dir, col, isCapture: false });
            // two-square initial move
            if (row === startRow && !b[row + 2 * dir][col]) {
                moves.push({ row: row + 2 * dir, col, isCapture: false });
            }
        }
        // diagonal captures
        for (const dc of [-1, 1]) {
            const target = pieceAt(b, row + dir, col + dc);
            if (target && target.color !== color) {
                moves.push({ row: row + dir, col: col + dc, isCapture: true });
            }
        }
    }

    if (type === "n") {
        const deltas = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of deltas) {
            const r = row + dr, c = col + dc;
            const target = pieceAt(b, r, c);
            if (isOnBoard(r, c) && (!target || target.color !== color)) {
                moves.push({ row: r, col: c, isCapture: !!target });
            }
        }
    }

    if (type === "b") {
        moves.push(...slidingMoves(b, row, col, color, [[-1, -1], [-1, 1], [1, -1], [1, 1]]));
    }

    if (type === "r") {
        moves.push(...slidingMoves(b, row, col, color, [[-1, 0], [1, 0], [0, -1], [0, 1]]));
    }

    if (type === "q") {
        moves.push(...slidingMoves(b, row, col, color, [
            [-1, -1], [-1, 1], [1, -1], [1, 1],
            [-1, 0], [1, 0], [0, -1], [0, 1]
        ]));
    }

    if (type === "k") {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr, c = col + dc;
                const target = pieceAt(b, r, c);
                if (isOnBoard(r, c) && (!target || target.color !== color)) {
                    moves.push({ row: r, col: c, isCapture: !!target });
                }
            }
        }
    }

    return moves;
}

// Is `row,col` attacked by any piece of `byColor`?
function isSquareAttacked(b, row, col, byColor) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p && p.color === byColor) {
                const moves = pseudoMoves(b, r, c);
                if (moves.some(m => m.row === row && m.col === col)) return true;
            }
        }
    }
    return false;
}

function isInCheck(b, color) {
    const king = findKing(b, color);
    if (!king) return false;
    const opponent = color === "w" ? "b" : "w";
    return isSquareAttacked(b, king.row, king.col, opponent);
}

// Legal moves = pseudo-legal moves that do not leave your own king in check
function legalMovesFor(b, row, col) {
    const piece = b[row][col];
    if (!piece) return [];
    const candidates = pseudoMoves(b, row, col);
    return candidates.filter(move => {
        const testBoard = cloneBoard(b);
        testBoard[move.row][move.col] = testBoard[row][col];
        testBoard[row][col] = null;
        return !isInCheck(testBoard, piece.color);
    });
}

function hasAnyLegalMove(b, color) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p && p.color === color && legalMovesFor(b, r, c).length > 0) return true;
        }
    }
    return false;
}

// ---------- Rendering ----------

function renderBoard() {
    boardEl.innerHTML = "";
    const inCheckColor = isInCheck(board, currentTurn) ? currentTurn : null;
    const kingInCheckPos = inCheckColor ? findKing(board, inCheckColor) : null;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement("div");
            square.className = "square " + ((row + col) % 2 === 0 ? "light" : "dark");

            const piece = board[row][col];
            if (piece) {
                square.innerHTML = UNICODE[piece.color][piece.type];
                square.classList.add(piece.color === "w" ? "piece-white" : "piece-black");
            }

            if (selected && selected.row === row && selected.col === col) {
                square.classList.add("selected");
            }

            const legalMove = legalMoves.find(m => m.row === row && m.col === col);
            if (legalMove) {
                square.classList.add(legalMove.isCapture ? "legal-capture" : "legal-move");
            }

            if (kingInCheckPos && kingInCheckPos.row === row && kingInCheckPos.col === col) {
                square.classList.add("in-check");
            }

            square.addEventListener("click", () => onSquareClick(row, col));
            boardEl.appendChild(square);
        }
    }

    updateStatus();
}

function updateStatus() {
    const colorName = currentTurn === "w" ? "White" : "Black";
    turnSwatchEl.classList.toggle("black", currentTurn === "b");

    if (gameOver) return;

    if (isInCheck(board, currentTurn)) {
        if (!hasAnyLegalMove(board, currentTurn)) {
            turnTextEl.textContent = `Checkmate — ${currentTurn === "w" ? "Black" : "White"} wins`;
            messageEl.textContent = "Game over. Click \"New game\" to play again.";
            gameOver = true;
            return;
        }
        turnTextEl.textContent = `${colorName} to move — in check`;
    } else {
        if (!hasAnyLegalMove(board, currentTurn)) {
            turnTextEl.textContent = "Stalemate";
            messageEl.textContent = "Game over. Click \"New game\" to play again.";
            gameOver = true;
            return;
        }
        turnTextEl.textContent = `${colorName} to move`;
    }
}

// ---------- Interaction ----------

function onSquareClick(row, col) {
    if (gameOver) return;
    const piece = board[row][col];

    // Case 1: a piece is already selected
    if (selected) {
        const move = legalMoves.find(m => m.row === row && m.col === col);

        if (move) {
            makeMove(selected.row, selected.col, row, col);
            selected = null;
            legalMoves = [];
            renderBoard();
            return;
        }

        // clicked the same square again -> deselect
        if (selected.row === row && selected.col === col) {
            selected = null;
            legalMoves = [];
            renderBoard();
            return;
        }

        // clicked another one of your own pieces -> switch selection
        if (piece && piece.color === currentTurn) {
            selected = { row, col };
            legalMoves = legalMovesFor(board, row, col);
            renderBoard();
            return;
        }

        // clicked an illegal square -> deselect, no move
        messageEl.textContent = "Illegal move.";
        selected = null;
        legalMoves = [];
        renderBoard();
        return;
    }

    // Case 2: nothing selected yet
    if (piece && piece.color === currentTurn) {
        selected = { row, col };
        legalMoves = legalMovesFor(board, row, col);
        messageEl.textContent = "";
        renderBoard();
    }
}

function makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;

    // pawn promotion -> auto-queen
    if (piece.type === "p" && (toRow === 0 || toRow === 7)) {
        piece.type = "q";
    }

    currentTurn = currentTurn === "w" ? "b" : "w";
    messageEl.textContent = "";
}

function resetGame() {
    board = createInitialBoard();
    currentTurn = "w";
    selected = null;
    legalMoves = [];
    gameOver = false;
    messageEl.textContent = "";
    renderBoard();
}

resetBtn.addEventListener("click", resetGame);

// ---------- Start ----------
resetGame();