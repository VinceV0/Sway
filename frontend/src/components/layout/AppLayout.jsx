import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Player from './Player';
import MobileNav from './MobileNav';

export default function AppLayout({ children }) {
    return (
        <div className="min-h-screen bg-background text-on-background flex">
            {/* Left Sidebar */}
            <Sidebar />

            {/* Right Content Area */}
            <div className="flex-1 md:ml-64 flex flex-col min-h-screen pb-32">
                <Header />
                <main className="flex-1 mt-20">
                    {children}
                </main>
            </div>

            {/* Persistent Audio Controls */}
            <MobileNav />
            <Player />
        </div>
    );
}