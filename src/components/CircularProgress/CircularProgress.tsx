import React from "react";
import "./CircularProgress.css"; // Ensure you include the styles

interface CircularProgressProps {
  percentage: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ percentage }) => {
  return (
    <div className="progress-circle" style={{ "--percentage": percentage + "%" } as React.CSSProperties}>
      <span>{percentage}%</span>
    </div>
  );
};

export default CircularProgress;
