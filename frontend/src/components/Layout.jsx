import React from 'react';
import { useLocation } from 'react-router-dom';

// Import your UI components (assuming they are in the same folder)
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import BottomPlayer from './layout/Player';
import MobileNav from './layout/MobileNav';

export default function Layout({ children }) {
    const location = useLocation();
    
    // Check if the current route is the sign-in page
    const isSignInPage = location.pathname === '/signin';

    // If on the sign-in page, render a clean canvas without the app UI
    if (isSignInPage) {
        return (
            <main className="min-h-screen bg-background text-on-background font-body-md selection:bg-primary/30">
                {children}
            </main>
        );
    }

    // For all other pages, render the full application UI wrapper
    return (
        <div className="bg-background text-on-background font-body-md selection:bg-primary/30 min-h-screen overflow-x-hidden">
            {/* Sidebar Navigation */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="md:ml-64 relative pb-4">
                
                {/* Top App Bar */}
                <Header />

                {/* Dynamic Page Content Injector */}
                <div className="pt-24 px-container-padding max-w-7xl mx-auto space-y-10">
                    {children}
                </div>
                
            </main>

            {/* Compact Bottom Player */}
            <Player />

            {/* Mobile Nav */}
            <MobileNav />
        </div>
    );
}