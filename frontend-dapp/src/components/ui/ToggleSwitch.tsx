import React from 'react';

interface ToggleSwitchProps {
  isAuction: boolean;
  onToggle: () => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ isAuction, onToggle }) => {
  return (
    <div
      className="relative inline-flex items-center cursor-pointer w-24 h-10 rounded-full transition-colors duration-200 ease-in-out"
      onClick={onToggle}
    >
      <input type="checkbox" className="sr-only" checked={isAuction} onChange={onToggle} />
      <div
        className={`w-full h-full rounded-full flex items-center justify-around text-sm font-medium ${
          isAuction ? 'bg-purple-600' : 'bg-green-600'
        }`}
      >
        <span
          className={`px-3 py-1 rounded-full transition-colors duration-200 ${
            !isAuction ? 'bg-white text-green-700 shadow' : 'text-white'
          }`}
        >
          Vendita
        </span>
        <span
          className={`px-3 py-1 rounded-full transition-colors duration-200 ${
            isAuction ? 'bg-white text-purple-700 shadow' : 'text-white'
          }`}
        >
          Asta
        </span>
      </div>
      <div
        className={`absolute left-0 w-1/2 h-full bg-white rounded-full shadow-lg transform transition-transform duration-200 ease-in-out ${
          isAuction ? 'translate-x-full' : 'translate-x-0'
        }`}
      ></div>
    </div>
  );
};

export default ToggleSwitch;