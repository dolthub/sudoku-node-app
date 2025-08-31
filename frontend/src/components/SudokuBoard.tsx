import React, { useState, useEffect } from 'react';
import './SudokuBoard.css';

interface SudokuBoardProps {
  board: number[][];
  errors: boolean[][];
  showErrors: boolean;
  branch: string;
  size: number;
  onCellUpdate: (row: number, col: number, value: number) => Promise<void>;
}

const SudokuBoard: React.FC<SudokuBoardProps> = ({ board, errors, showErrors, branch, size, onCellUpdate }) => {
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const [updating, setUpdating] = useState(false);

  // Initialize selection to first empty cell (upper-left) only when board first loads
  useEffect(() => {
    if (board.length === size && selectedCell === null) {
      // Find the first empty cell (upper-left most)
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (board[row][col] === 0) {
            setSelectedCell({ row, col });
            return;
          }
        }
      }
      // If no empty cells, select (0,0)
      setSelectedCell({ row: 0, col: 0 });
    }
  }, [board.length, size]); // Depend on both board.length and size

  useEffect(() => {
    const handleKeyPress = async (event: KeyboardEvent) => {
      if (!selectedCell || updating) return;

      const key = event.key;
      let value: number | null = null;

      // Handle number input based on game size
      if (size === 9 && key >= '0' && key <= '9') {
        value = parseInt(key);
      } else if (size === 16) {
        // For 16x16, support 0-9 and A-F (hex notation)
        if (key >= '0' && key <= '9') {
          value = parseInt(key);
        } else if (key.toLowerCase() >= 'a' && key.toLowerCase() <= 'f') {
          value = key.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0) + 10;
        }
      }
      
      if (key === 'Backspace' || key === 'Delete') {
        value = 0;
      } else if (key === 'Escape') {
        setSelectedCell(null);
        return;
      }
      // Handle arrow key navigation
      else if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
        event.preventDefault(); // Prevent page scrolling
        
        let newRow = selectedCell.row;
        let newCol = selectedCell.col;
        
        switch (key) {
          case 'ArrowUp':
            newRow = Math.max(0, selectedCell.row - 1);
            break;
          case 'ArrowDown':
            newRow = Math.min(size - 1, selectedCell.row + 1);
            break;
          case 'ArrowLeft':
            newCol = Math.max(0, selectedCell.col - 1);
            break;
          case 'ArrowRight':
            newCol = Math.min(size - 1, selectedCell.col + 1);
            break;
        }
        
        setSelectedCell({ row: newRow, col: newCol });
        return;
      }

      // Handle cell value updates
      if (value !== null) {
        try {
          setUpdating(true);
          await onCellUpdate(selectedCell.row + 1, selectedCell.col + 1, value);
          // Keep the same cell selected after update
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

  const subgridSize = size === 16 ? 4 : 3;
  
  const formatCellValue = (value: number): string => {
    if (value === 0) return '';
    if (size === 16 && value > 9) {
      return String.fromCharCode('A'.charCodeAt(0) + value - 10); // 10=A, 11=B, etc.
    }
    return value.toString();
  };
  
  return (
    <div className={`sudoku-board sudoku-${size}x${size}`} tabIndex={0}>
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="sudoku-row">
          {row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`sudoku-cell ${
                Math.floor(rowIndex / subgridSize) % 2 === Math.floor(colIndex / subgridSize) % 2
                  ? 'light-section'
                  : 'dark-section'
              } ${
                selectedCell?.row === rowIndex && selectedCell?.col === colIndex
                  ? 'selected'
                  : ''
              } ${
                showErrors && errors && errors.length > 0 && errors[rowIndex]?.[colIndex]
                  ? 'error'
                  : ''
              }`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
            >
              {formatCellValue(cell)}
              {updating && selectedCell?.row === rowIndex && selectedCell?.col === colIndex && (
                <div className="updating-indicator">...</div>
              )}
            </div>
          ))}
        </div>
      ))}
      {selectedCell && (
        <div className="instructions">
          {size === 9 ? 'Press 1-9 to set value, 0 to clear, ESC to deselect' : 'Press 1-9,A-F to set value, 0 to clear, ESC to deselect'}
        </div>
      )}
    </div>
  );
};

export default SudokuBoard;