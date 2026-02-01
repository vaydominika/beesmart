import React from 'react'

interface FancyCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const FancyCard = ({ children, className, ...props }: FancyCardProps) => {
    const bgMatch = className?.match(/bg-[^\s]+/);
    const bgClass = bgMatch ? bgMatch[0] : 'bg-(--theme-card)';
    const otherClasses = className?.replace(/bg-[^\s]+/g, '').trim() || '';
    
    return (
        <div 
            className={`custom-shadow ${bgClass} corner-squircle rounded-2xl overflow-hidden ${otherClasses}`}
            {...props}
        >
            <div className='bg-linear-to-b from-white to-transparent'>
                <div className={`${bgClass} rounded-xl corner-squircle transition-all`}>
                    {children}
                </div>
            </div>
        </div>
    );
};