// ── Lightweight Chess Engine ──────────────────────────────────────────
// Self-contained: no dependencies. Handles all standard rules including
// castling, en passant, promotion, check, checkmate, and stalemate.

const PIECES = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function isWhite(piece) { return piece && piece === piece.toUpperCase(); }
function isBlack(piece) { return piece && piece === piece.toLowerCase(); }
function sameColor(a, b) { return (isWhite(a) && isWhite(b)) || (isBlack(a) && isBlack(b)); }

function parseFEN(fen) {
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  const board = Array(8).fill(null).map(() => Array(8).fill(null));

  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') c += parseInt(ch);
      else { board[r][c] = ch; c++; }
    }
  }

  return {
    board,
    turn: parts[1] || 'w',
    castling: parts[2] || '-',
    enPassant: parts[3] || '-',
    halfMoves: parseInt(parts[4]) || 0,
    fullMoves: parseInt(parts[5]) || 1,
  };
}

function toFEN(state) {
  let fen = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      if (state.board[r][c]) {
        if (empty) { fen += empty; empty = 0; }
        fen += state.board[r][c];
      } else empty++;
    }
    if (empty) fen += empty;
    if (r < 7) fen += '/';
  }
  return `${fen} ${state.turn} ${state.castling || '-'} ${state.enPassant || '-'} ${state.halfMoves} ${state.fullMoves}`;
}

function copyBoard(board) {
  return board.map(row => [...row]);
}

function findKing(board, white) {
  const king = white ? 'K' : 'k';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === king) return [r, c];
  return null;
}

function isAttacked(board, r, c, byWhite) {
  // Knight attacks
  const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const knight = byWhite ? 'N' : 'n';
  for (const [dr, dc] of knightMoves) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === knight) return true;
  }

  // King attacks
  const king = byWhite ? 'K' : 'k';
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr][nc] === king) return true;
    }

  // Pawn attacks
  const pawn = byWhite ? 'P' : 'p';
  const pawnDir = byWhite ? 1 : -1; // white pawns attack from below
  if (r + pawnDir >= 0 && r + pawnDir < 8) {
    if (c - 1 >= 0 && board[r + pawnDir][c - 1] === pawn) return true;
    if (c + 1 < 8 && board[r + pawnDir][c + 1] === pawn) return true;
  }

  // Rook/Queen (straight lines)
  const rook = byWhite ? 'R' : 'r';
  const queen = byWhite ? 'Q' : 'q';
  for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    for (let i = 1; i < 8; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
      if (board[nr][nc]) {
        if (board[nr][nc] === rook || board[nr][nc] === queen) return true;
        break;
      }
    }
  }

  // Bishop/Queen (diagonals)
  const bishop = byWhite ? 'B' : 'b';
  for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
    for (let i = 1; i < 8; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
      if (board[nr][nc]) {
        if (board[nr][nc] === bishop || board[nr][nc] === queen) return true;
        break;
      }
    }
  }

  return false;
}

function inCheck(board, white) {
  const kp = findKing(board, white);
  if (!kp) return false;
  return isAttacked(board, kp[0], kp[1], !white);
}

// Generate all pseudo-legal moves, then filter for legality
function generateMoves(state) {
  const { board, turn, castling, enPassant } = state;
  const white = turn === 'w';
  const moves = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      if (white && !isWhite(piece)) continue;
      if (!white && !isBlack(piece)) continue;

      const type = piece.toLowerCase();

      const addMove = (tr, tc, promotion = null) => {
        moves.push({ from: [r, c], to: [tr, tc], piece, promotion });
      };

      const trySlide = (dirs) => {
        for (const [dr, dc] of dirs) {
          for (let i = 1; i < 8; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
            if (board[nr][nc]) {
              if (!sameColor(piece, board[nr][nc])) addMove(nr, nc);
              break;
            }
            addMove(nr, nc);
          }
        }
      };

      if (type === 'p') {
        const dir = white ? -1 : 1;
        const startRow = white ? 6 : 1;
        const promoRow = white ? 0 : 7;

        // Forward
        if (r + dir >= 0 && r + dir < 8 && !board[r + dir][c]) {
          if (r + dir === promoRow) {
            for (const p of (white ? ['Q','R','B','N'] : ['q','r','b','n'])) addMove(r + dir, c, p);
          } else {
            addMove(r + dir, c);
          }
          // Double push
          if (r === startRow && !board[r + 2 * dir][c]) addMove(r + 2 * dir, c);
        }

        // Captures
        for (const dc of [-1, 1]) {
          const nr = r + dir, nc = c + dc;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
          if (board[nr][nc] && !sameColor(piece, board[nr][nc])) {
            if (nr === promoRow) {
              for (const p of (white ? ['Q','R','B','N'] : ['q','r','b','n'])) addMove(nr, nc, p);
            } else addMove(nr, nc);
          }
          // En passant
          if (enPassant !== '-') {
            const epC = enPassant.charCodeAt(0) - 97;
            const epR = 8 - parseInt(enPassant[1]);
            if (nr === epR && nc === epC) addMove(nr, nc);
          }
        }
      }

      if (type === 'n') {
        for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !sameColor(piece, board[nr][nc])) addMove(nr, nc);
        }
      }

      if (type === 'b') trySlide([[1,1],[1,-1],[-1,1],[-1,-1]]);
      if (type === 'r') trySlide([[0,1],[0,-1],[1,0],[-1,0]]);
      if (type === 'q') trySlide([[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]);

      if (type === 'k') {
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !sameColor(piece, board[nr][nc])) addMove(nr, nc);
          }

        // Castling
        if (!inCheck(board, white)) {
          if (white) {
            if (castling.includes('K') && !board[7][5] && !board[7][6] &&
                board[7][7] === 'R' && !isAttacked(board, 7, 5, true) && !isAttacked(board, 7, 6, true))
              addMove(7, 6);
            if (castling.includes('Q') && !board[7][3] && !board[7][2] && !board[7][1] &&
                board[7][0] === 'R' && !isAttacked(board, 7, 3, true) && !isAttacked(board, 7, 2, true))
              addMove(7, 2);
          } else {
            if (castling.includes('k') && !board[0][5] && !board[0][6] &&
                board[0][7] === 'r' && !isAttacked(board, 0, 5, false) && !isAttacked(board, 0, 6, false))
              addMove(0, 6);
            if (castling.includes('q') && !board[0][3] && !board[0][2] && !board[0][1] &&
                board[0][0] === 'r' && !isAttacked(board, 0, 3, false) && !isAttacked(board, 0, 2, false))
              addMove(0, 2);
          }
        }
      }
    }
  }

  // Filter out moves that leave king in check
  return moves.filter(move => {
    const nb = copyBoard(board);
    nb[move.to[0]][move.to[1]] = move.promotion || move.piece;
    nb[move.from[0]][move.from[1]] = null;

    // En passant capture
    if (move.piece.toLowerCase() === 'p' && move.to[1] !== move.from[1] && !board[move.to[0]][move.to[1]]) {
      nb[move.from[0]][move.to[1]] = null;
    }

    // Castling — move the rook
    if (move.piece.toLowerCase() === 'k' && Math.abs(move.to[1] - move.from[1]) === 2) {
      if (move.to[1] === 6) { nb[move.to[0]][5] = nb[move.to[0]][7]; nb[move.to[0]][7] = null; }
      if (move.to[1] === 2) { nb[move.to[0]][3] = nb[move.to[0]][0]; nb[move.to[0]][0] = null; }
    }

    return !inCheck(nb, white);
  });
}

function makeMove(state, move) {
  const nb = copyBoard(state.board);
  const piece = nb[move.from[0]][move.from[1]];
  const white = state.turn === 'w';

  nb[move.to[0]][move.to[1]] = move.promotion || piece;
  nb[move.from[0]][move.from[1]] = null;

  let newEP = '-';

  // En passant capture
  if (piece.toLowerCase() === 'p' && move.to[1] !== move.from[1] && !state.board[move.to[0]][move.to[1]]) {
    nb[move.from[0]][move.to[1]] = null;
  }

  // Pawn double push — set en passant square
  if (piece.toLowerCase() === 'p' && Math.abs(move.to[0] - move.from[0]) === 2) {
    const epRow = (move.from[0] + move.to[0]) / 2;
    newEP = String.fromCharCode(97 + move.to[1]) + (8 - epRow);
  }

  // Castling — move rook
  if (piece.toLowerCase() === 'k' && Math.abs(move.to[1] - move.from[1]) === 2) {
    if (move.to[1] === 6) { nb[move.to[0]][5] = nb[move.to[0]][7]; nb[move.to[0]][7] = null; }
    if (move.to[1] === 2) { nb[move.to[0]][3] = nb[move.to[0]][0]; nb[move.to[0]][0] = null; }
  }

  // Update castling rights
  let cast = state.castling;
  if (piece === 'K') cast = cast.replace('K', '').replace('Q', '');
  if (piece === 'k') cast = cast.replace('k', '').replace('q', '');
  if (piece === 'R' && move.from[0] === 7 && move.from[1] === 7) cast = cast.replace('K', '');
  if (piece === 'R' && move.from[0] === 7 && move.from[1] === 0) cast = cast.replace('Q', '');
  if (piece === 'r' && move.from[0] === 0 && move.from[1] === 7) cast = cast.replace('k', '');
  if (piece === 'r' && move.from[0] === 0 && move.from[1] === 0) cast = cast.replace('q', '');
  // If rook captured
  if (move.to[0] === 0 && move.to[1] === 7) cast = cast.replace('k', '');
  if (move.to[0] === 0 && move.to[1] === 0) cast = cast.replace('q', '');
  if (move.to[0] === 7 && move.to[1] === 7) cast = cast.replace('K', '');
  if (move.to[0] === 7 && move.to[1] === 0) cast = cast.replace('Q', '');
  if (!cast) cast = '-';

  const isCapture = state.board[move.to[0]][move.to[1]] !== null;
  const isPawnMove = piece.toLowerCase() === 'p';

  return {
    board: nb,
    turn: white ? 'b' : 'w',
    castling: cast,
    enPassant: newEP,
    halfMoves: (isCapture || isPawnMove) ? 0 : state.halfMoves + 1,
    fullMoves: white ? state.fullMoves : state.fullMoves + 1,
  };
}

// ── Public API ────────────────────────────────────────────────────────

export function createGame() {
  return parseFEN(INITIAL_FEN);
}

export function getBoard(state) {
  return state.board;
}

export function getTurn(state) {
  return state.turn;
}

export function getLegalMoves(state, row, col) {
  const allMoves = generateMoves(state);
  return allMoves.filter(m => m.from[0] === row && m.from[1] === col);
}

export function getAllLegalMoves(state) {
  return generateMoves(state);
}

export function tryMove(state, fromRow, fromCol, toRow, toCol, promotion = null) {
  const legal = getLegalMoves(state, fromRow, fromCol);
  const move = legal.find(m => m.to[0] === toRow && m.to[1] === toCol &&
    (!promotion || m.promotion === promotion));

  if (!move) return null;

  // If it's a promotion move and no promotion specified, default to queen
  const actualMove = move.promotion && !promotion
    ? { ...move, promotion: state.turn === 'w' ? 'Q' : 'q' }
    : move;

  return makeMove(state, actualMove);
}

export function isInCheck(state) {
  return inCheck(state.board, state.turn === 'w');
}

export function isCheckmate(state) {
  return isInCheck(state) && generateMoves(state).length === 0;
}

export function isStalemate(state) {
  return !isInCheck(state) && generateMoves(state).length === 0;
}

export function isDraw(state) {
  if (isStalemate(state)) return true;
  if (state.halfMoves >= 100) return true; // 50-move rule
  return false;
}

export function isGameOver(state) {
  return isCheckmate(state) || isDraw(state);
}

export function getGameStatus(state) {
  if (isCheckmate(state)) return state.turn === 'w' ? 'black_wins' : 'white_wins';
  if (isStalemate(state)) return 'stalemate';
  if (state.halfMoves >= 100) return 'draw_50move';
  if (isInCheck(state)) return 'check';
  return 'playing';
}

export function stateToFEN(state) {
  return toFEN(state);
}

export function stateFromFEN(fen) {
  return parseFEN(fen);
}

export function getPieceSymbol(piece) {
  return PIECES[piece] || '';
}

export { PIECES };
