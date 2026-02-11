import React from 'react'

interface FancyCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

export const FancyCard = ({ children, className, ...props }: FancyCardProps) => {
    const bgMatch = className?.match(/bg-[^\s]+/);
    const bgClass = bgMatch ? bgMatch[0] : 'bg-(--theme-card)';
    // Separate padding/margin classes from other classes
    const paddingRegex = /\b(p-|px-|py-|pt-|pr-|pb-|pl-|ps-|pe-)\S+/g;
    const paddingClasses = className?.match(paddingRegex)?.join(' ') || '';
    const otherClasses = className?.replace(/bg-[^\s]+/g, '').replace(paddingRegex, '').trim() || '';

    return (
        <div
            className={`custom-shadow ${bgClass} corner-squircle rounded-2xl overflow-hidden ${otherClasses}`}
            {...props}
        >
            <div className='bg-linear-to-b from-white to-transparent p-[1.5px]'>
                <div className={`${bgClass} rounded-xl corner-squircle transition-all ${paddingClasses}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};