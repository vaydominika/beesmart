import React from 'react'

interface FancyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export const FancyButton = ({ children, className, ...props }: FancyButtonProps) => {
    const bgMatch = className?.match(/bg-[^\s]+/);
    const bgClass = bgMatch ? bgMatch[0] : 'bg-(--theme-card)';
    const otherClasses = className?.replace(/bg-[^\s]+/g, '').trim() || '';
    
    const isIconButton = otherClasses?.includes('p-0') || otherClasses?.includes('size-') || otherClasses?.includes('w-') && otherClasses?.includes('h-');
    const innerPadding = isIconButton ? 'p-0' : 'px-4 py-1';
    
    return (
        <button 
            className={`custom-shadow ${bgClass} corner-squircle rounded-2xl overflow-hidden ${otherClasses}`}
            {...props}
        >
            <div className='bg-linear-to-b from-white to-transparent'>
                <div className={`${bgClass} ${innerPadding} rounded-xl corner-squircle transition-all hover:opacity-90 active:opacity-80 flex items-center justify-center`}>
                    {children}
                </div>
            </div>
        </button>
    );
};