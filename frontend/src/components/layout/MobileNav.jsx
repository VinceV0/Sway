import React from 'react';

export default function MobileNav() {
    return (
        <nav className="md:hidden fixed bottom-24 left-0 right-0 glass-panel border-t border-white/5 z-40 px-6 py-2 flex justify-around items-center">
            <a href="#" className="flex flex-col items-center gap-1 text-primary">
                <span className="material-symbols-outlined">home</span>
                <span className="text-[10px] font-bold">Home</span>
            </a>
            <a href="#" className="flex flex-col items-center gap-1 text-on-surface-variant">
                <span className="material-symbols-outlined">explore</span>
                <span className="text-[10px] font-bold">Discover</span>
            </a>
            <a href="#" className="flex flex-col items-center gap-1 text-on-surface-variant">
                <span className="material-symbols-outlined">library_music</span>
                <span className="text-[10px] font-bold">Library</span>
            </a>
        </nav>
    );
}