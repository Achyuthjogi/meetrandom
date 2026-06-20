import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Gamepad2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { getBoard, PIECES, getLegalMoves } from '../lib/chessEngine';

// ── Would You Rather ──────────────────────────────────────────────────

const WYR_QUESTIONS = [
  ["Have unlimited money", "Have unlimited time"],
  ["Be able to fly", "Be invisible"],
  ["Live in the past", "Live in the future"],
  ["Never use social media again", "Never watch another movie"],
  ["Always speak your mind", "Never speak again"],
  ["Be famous", "Be the richest person nobody knows"],
  ["Have a rewind button", "A pause button for life"],
  ["Live without music", "Live without movies"],
  ["Be 10 years older", "4 years younger"],
  ["Know the date of your death", "Know the cause of your death"],
  ["Travel the world for free", "Have your dream house"],
  ["Only eat pizza forever", "Only eat sushi forever"],
  ["Read minds", "See the future"],
  ["Be a genius", "Be extremely lucky"],
  ["Have unlimited battery", "Unlimited WiFi everywhere"],
];

function WouldYouRather({ question, myPick, partnerPick, onPick, onClose }) {
  const bothPicked = myPick !== null && partnerPick !== null;

  return (
    <div className="flex flex-col h-full">
      <div className="text-center mb-6">
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-cyan mb-2">Would You Rather</h4>
      </div>

      {question && (
        <div className="flex-1 flex flex-col gap-3">
          {question.map((option, i) => {
            const isMyPick = myPick === i;
            const isPartnerPick = partnerPick === i;
            
            return (
              <motion.button
                key={i}
                whileHover={myPick === null ? { scale: 1.02 } : {}}
                whileTap={myPick === null ? { scale: 0.98 } : {}}
                onClick={() => myPick === null && onPick(i)}
                disabled={myPick !== null}
                className={cn(
                  "flex-1 rounded-2xl p-5 text-left transition-all duration-300 border relative overflow-hidden",
                  myPick === null
                    ? "bg-surface/50 border-white/10 hover:border-accent/30 hover:bg-surface cursor-pointer"
                    : isMyPick
                      ? "bg-accent/20 border-accent/40"
                      : "bg-surface/30 border-white/5 opacity-60"
                )}
              >
                <span className="text-lg font-semibold text-white">{option}</span>
                {bothPicked && (
                  <div className="flex gap-2 mt-2">
                    {isMyPick && (
                      <span className="text-xs bg-accent/30 text-accent px-2 py-0.5 rounded-full font-medium">You</span>
                    )}
                    {isPartnerPick && (
                      <span className="text-xs bg-cyan/30 text-cyan px-2 py-0.5 rounded-full font-medium">Stranger</span>
                    )}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {myPick !== null && partnerPick === null && (
        <p className="text-center text-sm text-muted mt-4 animate-pulse">Waiting for stranger to pick...</p>
      )}
      {bothPicked && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "text-center text-sm font-semibold mt-4",
            myPick === partnerPick ? "text-success" : "text-cyan"
          )}
        >
          {myPick === partnerPick ? "🎉 Great minds think alike!" : "🤔 Opposites attract!"}
        </motion.p>
      )}
    </div>
  );
}

// ── Tic-Tac-Toe ────────────────────────────────────────────────────────

function TicTacToe({ board, isMyTurn, mySymbol, winner, onMove, onReset }) {
  const partnerSymbol = mySymbol === 'X' ? 'O' : 'X';

  return (
    <div className="flex flex-col items-center h-full">
      <div className="text-center mb-4">
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-cyan mb-2">Tic-Tac-Toe</h4>
        {!winner && (
          <p className={cn(
            "text-sm font-medium",
            isMyTurn ? "text-success" : "text-muted"
          )}>
            {isMyTurn ? "Your turn!" : "Stranger's turn..."}
          </p>
        )}
        {winner && (
          <motion.p
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "text-lg font-bold",
              winner === 'draw' ? "text-muted" : winner === mySymbol ? "text-success" : "text-red-400"
            )}
          >
            {winner === 'draw' ? "It's a draw! 🤝" : winner === mySymbol ? "You won! 🎉" : "You lost! 😅"}
          </motion.p>
        )}
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {board.map((cell, i) => (
          <motion.button
            key={i}
            whileHover={!cell && isMyTurn && !winner ? { scale: 1.05 } : {}}
            whileTap={!cell && isMyTurn && !winner ? { scale: 0.95 } : {}}
            onClick={() => !cell && isMyTurn && !winner && onMove(i)}
            className={cn(
              "w-16 h-16 sm:w-20 sm:h-20 rounded-xl border flex items-center justify-center text-2xl font-bold transition-all",
              !cell && isMyTurn && !winner
                ? "bg-surface/50 border-white/15 hover:border-accent/40 cursor-pointer"
                : "bg-surface/30 border-white/5",
              cell === mySymbol && "text-accent",
              cell === partnerSymbol && "text-cyan"
            )}
          >
            {cell && (
              <motion.span
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 15 }}
              >
                {cell}
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>

      <div className="flex gap-3 text-sm">
        <span className="text-accent font-semibold">You: {mySymbol}</span>
        <span className="text-white/20">•</span>
        <span className="text-cyan font-semibold">Stranger: {partnerSymbol}</span>
      </div>

      {winner && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReset}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-accent/20 hover:bg-accent/30 border border-accent/30 rounded-full text-accent text-sm font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Play Again
        </motion.button>
      )}
    </div>
  );
}

// ── Chess ──────────────────────────────────────────────────────────────

function ChessGame({ state, isMyTurn, myColor, status, onMove, onReset }) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);

  const board = state ? getBoard(state) : null;
  const isGameOver = status && status !== 'playing' && status !== 'check';

  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [state]);

  if (!board) return null;

  const handleSquareClick = (r, c) => {
    if (!isMyTurn || isGameOver) return;

    // If clicking a legal move destination
    const move = legalMoves.find(m => m.to[0] === r && m.to[1] === c);
    if (move) {
      onMove(selectedSquare[0], selectedSquare[1], r, c, move.promotion);
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // If clicking own piece to select
    const piece = board[r][c];
    if (piece) {
      const isWhite = piece === piece.toUpperCase();
      if ((myColor === 'w' && isWhite) || (myColor === 'b' && !isWhite)) {
        if (selectedSquare && selectedSquare[0] === r && selectedSquare[1] === c) {
          // Deselect
          setSelectedSquare(null);
          setLegalMoves([]);
        } else {
          // Select new piece
          setSelectedSquare([r, c]);
          setLegalMoves(getLegalMoves(state, r, c));
        }
        return;
      }
    }

    // Clicking elsewhere
    setSelectedSquare(null);
    setLegalMoves([]);
  };

  // Flip board for black
  const displayRows = myColor === 'b' ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const displayCols = myColor === 'b' ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];

  return (
    <div className="flex flex-col items-center h-full w-full">
      <div className="text-center mb-4 w-full">
        <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2">Chess</h4>
        {!isGameOver && (
          <p className={cn(
            "text-sm font-medium",
            status === 'check' ? "text-red-400" : isMyTurn ? "text-success" : "text-muted"
          )}>
            {status === 'check' ? "Check!" : isMyTurn ? "Your turn!" : "Stranger's turn..."}
          </p>
        )}
        {isGameOver && (
          <motion.p
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              "text-lg font-bold",
              status === 'draw_50move' || status === 'stalemate' ? "text-muted" : 
              (status === 'white_wins' && myColor === 'w') || (status === 'black_wins' && myColor === 'b') ? "text-success" : "text-red-400"
            )}
          >
            {status === 'stalemate' || status === 'draw_50move' ? "It's a draw! 🤝" : 
             (status === 'white_wins' && myColor === 'w') || (status === 'black_wins' && myColor === 'b') ? "You won! 🎉" : "You lost! 😅"}
          </motion.p>
        )}
      </div>

      <div className="w-full max-w-[320px] aspect-square rounded-sm overflow-hidden border border-white/20 shadow-2xl flex flex-col relative bg-[#E8EDF9]">
        {displayRows.map(r => (
          <div key={r} className="flex-1 flex">
            {displayCols.map(c => {
              const isDark = (r + c) % 2 !== 0;
              const piece = board[r][c];
              const isSelected = selectedSquare && selectedSquare[0] === r && selectedSquare[1] === c;
              const isLegal = legalMoves.some(m => m.to[0] === r && m.to[1] === c);

              return (
                <div
                  key={c}
                  onClick={() => handleSquareClick(r, c)}
                  className={cn(
                    "flex-1 relative flex items-center justify-center text-3xl select-none cursor-pointer transition-colors duration-150",
                    isDark ? "bg-[#7B92C2]" : "bg-[#E8EDF9]",
                    isSelected && "ring-inset ring-2 ring-accent/80 bg-accent/30",
                  )}
                >
                  {isLegal && (
                    <div className={cn(
                      "absolute z-10 rounded-full",
                      piece ? "w-full h-full ring-4 ring-inset ring-black/20" : "w-1/3 h-1/3 bg-black/20"
                    )} />
                  )}
                  {piece && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={cn(
                        "relative z-20 text-[#20252A]",
                        piece.toUpperCase() === piece ? "drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]" : "drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                      )}
                    >
                      {PIECES[piece]}
                    </motion.span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex gap-3 text-sm mt-4">
        <span className="font-semibold text-white">You: {myColor === 'w' ? 'White' : 'Black'}</span>
        <span className="text-white/20">•</span>
        <span className="font-semibold text-muted">Stranger: {myColor === 'w' ? 'Black' : 'White'}</span>
      </div>

      {isGameOver && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onReset}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-accent/20 hover:bg-accent/30 border border-accent/30 rounded-full text-accent text-sm font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Play Again
        </motion.button>
      )}
    </div>
  );
}

// ── Main MiniGame Component ────────────────────────────────────────────

export function MiniGame({
  isOpen,
  onClose,
  // TicTacToe props
  tttBoard,
  tttIsMyTurn,
  tttMySymbol,
  tttWinner,
  onTTTMove,
  onTTTReset,
  // WYR props
  wyrQuestion,
  wyrMyPick,
  wyrPartnerPick,
  onWYRPick,
  // Chess props
  chessState,
  chessIsMyTurn,
  chessMyColor,
  chessStatus,
  onChessMove,
  onChessReset,
  // Game selection
  onStartGame,
}) {
  const [selectedGame, setSelectedGame] = useState(null);

  useEffect(() => {
    if (tttBoard && tttBoard.some(c => c !== null)) setSelectedGame('ttt');
    if (wyrQuestion) setSelectedGame('wyr');
    if (chessState) setSelectedGame('chess');
  }, [tttBoard, wyrQuestion, chessState]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Panel */}
        <motion.div
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 30 }}
          transition={{ type: 'spring', damping: 25 }}
          className="relative z-10 glass-panel rounded-3xl p-6 max-w-md w-[90%] max-h-[80vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan/20 border border-cyan/30 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-cyan" />
              </div>
              <h3 className="text-white font-bold text-lg">Mini Games</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Game Select or Active Game */}
          {!selectedGame ? (
            <div className="grid gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setSelectedGame('chess'); onStartGame('chess'); }}
                className="flex items-center gap-4 p-4 bg-surface/50 border border-white/10 rounded-2xl hover:border-accent/30 transition-all text-left"
              >
                <span className="text-4xl text-[#E8EDF9] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">♘</span>
                <div>
                  <p className="font-bold text-white">Chess</p>
                  <p className="text-xs text-muted">The ultimate strategy game</p>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setSelectedGame('ttt'); onStartGame('ttt'); }}
                className="flex items-center gap-4 p-4 bg-surface/50 border border-white/10 rounded-2xl hover:border-accent/30 transition-all text-left"
              >
                <span className="text-3xl">❌⭕</span>
                <div>
                  <p className="font-bold text-white">Tic-Tac-Toe</p>
                  <p className="text-xs text-muted">Classic quick battle</p>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setSelectedGame('wyr'); onStartGame('wyr'); }}
                className="flex items-center gap-4 p-4 bg-surface/50 border border-white/10 rounded-2xl hover:border-cyan/30 transition-all text-left"
              >
                <span className="text-3xl">🤔</span>
                <div>
                  <p className="font-bold text-white">Would You Rather</p>
                  <p className="text-xs text-muted">Discover each other's vibes</p>
                </div>
              </motion.button>
            </div>
          ) : selectedGame === 'ttt' ? (
            <TicTacToe
              board={tttBoard || Array(9).fill(null)}
              isMyTurn={tttIsMyTurn}
              mySymbol={tttMySymbol || 'X'}
              winner={tttWinner}
              onMove={onTTTMove}
              onReset={onTTTReset}
            />
          ) : selectedGame === 'chess' ? (
            <ChessGame
              state={chessState}
              isMyTurn={chessIsMyTurn}
              myColor={chessMyColor}
              status={chessStatus}
              onMove={onChessMove}
              onReset={onChessReset}
            />
          ) : selectedGame === 'wyr' ? (
            <WouldYouRather
              question={wyrQuestion}
              myPick={wyrMyPick}
              partnerPick={wyrPartnerPick}
              onPick={onWYRPick}
              onClose={onClose}
            />
          ) : null}

          {/* Back to game list */}
          {selectedGame && (
            <button
              onClick={() => setSelectedGame(null)}
              className="mt-4 text-xs text-muted hover:text-white transition-colors underline underline-offset-2"
            >
              ← Back to games
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export { WYR_QUESTIONS };
