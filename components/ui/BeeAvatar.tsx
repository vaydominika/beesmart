export function BeeAvatar() {
  return (
    <div className="relative">
      {/* White outer circle */}
      <div className="w-16 h-16 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
        {/* Yellow inner circle */}
        <div className="w-12 h-12 rounded-full bg-[#FADA6D] flex items-center justify-center">
          {/* Bee icon - simple SVG bee */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Bee body */}
            <ellipse cx="12" cy="12" rx="6" ry="8" fill="#262626" />
            {/* Bee stripes */}
            <line x1="9" y1="10" x2="9" y2="14" stroke="#FADA6D" strokeWidth="1.5" />
            <line x1="12" y1="9" x2="12" y2="15" stroke="#FADA6D" strokeWidth="1.5" />
            <line x1="15" y1="10" x2="15" y2="14" stroke="#FADA6D" strokeWidth="1.5" />
            {/* Bee wings */}
            <ellipse cx="8" cy="10" rx="2" ry="3" fill="#262626" opacity="0.3" />
            <ellipse cx="16" cy="10" rx="2" ry="3" fill="#262626" opacity="0.3" />
          </svg>
        </div>
      </div>
    </div>
  );
}
