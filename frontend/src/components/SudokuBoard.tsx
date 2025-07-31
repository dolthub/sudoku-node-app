import React, { useState, useEffect } from 'react';
import './SudokuBoard.css';

interface SudokuBoardProps {
  board: number[][];
  branch: string;
  onCellUpdate: (row: number, col: number, value: number) => Promise<void>;
}

const SudokuBoard: React.FC<SudokuBoardProps> = ({ board, branch, onCellUpdate }) => {
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const handleKeyPress = async (event: KeyboardEvent) => {
      if (!selectedCell || updating) return;

      const key = event.key;
      let value: number | null = null;

      if (key >= '0' && key <= '9') {
        value = parseInt(key);
      } else if (key === 'Backspace' || key === 'Delete') {
        value = 0;
      } else if (key === 'Escape') {
        setSelectedCell(null);
        return;
      }

      if (value !== null) {
        try {
          setUpdating(true);
          await onCellUpdate(selectedCell.row + 1, selectedCell.col + 1, value);
        } catch (error) {
          console.error('Failed to update cell:', error);
        } finally {
          setUpdating(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedCell, onCellUpdate, updating]);

  const handleCellClick = (rowIndex: number, colIndex: number) => {
    setSelectedCell({ row: rowIndex, col: colIndex });
  };

  return (
    <div className="sudoku-board" tabIndex={0}>
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="sudoku-row">
          {row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`sudoku-cell ${
                Math.floor(rowIndex / 3) % 2 === Math.floor(colIndex / 3) % 2
                  ? 'light-section'
                  : 'dark-section'
              } ${
                selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                  ? 'selected'
                  : ''
              }`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
            >
              {cell !== 0 ? cell : ''}
              {updating && selectedCell?.row === rowIndex && selectedCell?.col === colIndex && (
                <div className="updating-indicator">...</div>
              )}
            </div>
          ))}
        </div>
      ))}
      {selectedCell && (
        <div className="instructions">
          Press 1-9 to set value, 0 to clear, ESC to deselect
        </div>
      )}
    </div>
  );
};

export default SudokuBoard;