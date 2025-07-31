import React from 'react';
import './SudokuBoard.css';

interface SudokuBoardProps {
  board: number[][];
}

const SudokuBoard: React.FC<SudokuBoardProps> = ({ board }) => {
  return (
    <div className="sudoku-board">
      {board.map((row, rowIndex) => (
        <div key={rowIndex} className="sudoku-row">
          {row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`sudoku-cell ${
                Math.floor(rowIndex / 3) % 2 === Math.floor(colIndex / 3) % 2
                  ? 'light-section'
                  : 'dark-section'
              }`}
            >
              {cell !== 0 ? cell : ''}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default SudokuBoard;