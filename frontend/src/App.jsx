import React, { useState, useEffect } from 'react';
import { navStore } from './store/navigation';
import { PlayerProvider } from './context/PlayerContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import HomePage from './pages/HomePage';
import DiscoverPage from './pages/DiscoverPage';
import ArtistChat from './components/chat/ArtistChat';
import Player from './components/Player';

export default function App() {
  const [activeTab, setActiveTab] = useState(navStore.getTab());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [initialListenerEmail, setInitialListenerEmail] = useState(null);

  // Auth states synced with localStorage
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(localStorage.getItem('currentUserEmail')));
  const [currentUserEmail, setCurrentUserEmail] = useState(localStorage.getItem('currentUserEmail') || '');
  const [currentUserName, setCurrentUserName] = useState(localStorage.getItem('currentUserName') || '');
  const [currentUserImage, setCurrentUserImage] = useState(localStorage.getItem('currentUserImage') || '');

  useEffect(() => {
    return navStore.subscribe(setActiveTab);
  }, []);

  // Handle selecting an artist from search, artist grid, or notifications with the specific listener thread
  const handleSelectArtist = (artistName, listenerEmail) => {
    setSelectedArtist(artistName);
    setInitialListenerEmail(listenerEmail || null);
    setActiveTab('artists');
  };

  const handleSignOut = () => {
    localStorage.removeItem('currentUserEmail');
    localStorage.removeItem('currentUserName');
    localStorage.removeItem('currentUserImage');
    setIsLoggedIn(false);
    setCurrentUserEmail('');
    setCurrentUserName('');
    setCurrentUserImage('');
  };

  return (
    <PlayerProvider>
      <div className="flex bg-[#08101a] min-h-screen text-[#e1e2ed] relative pb-24">
        <Sidebar />
        
        <Header 
          isLoggedIn={isLoggedIn}
          currentUserEmail={currentUserEmail}
          currentUserName={currentUserName}
          currentUserImage={currentUserImage}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSignOut={handleSignOut}
          onNavigateToSignIn={() => {
            if (typeof navStore.setTab === 'function') navStore.setTab('signup');
            else setActiveTab('signup');
          }}
          onNavigateToSignUp={() => {
            if (typeof navStore.setTab === 'function') navStore.setTab('signup');
            else setActiveTab('signup');
          }}
          onSelectArtist={handleSelectArtist}
        />

        <main className="ml-64 flex-1 pt-20">
          {selectedArtist ? (
            <ArtistChat 
              artistName={selectedArtist}
              initialListenerEmail={initialListenerEmail}
              currentUser={{ email: currentUserEmail, name: currentUserName }}
              isLoggedIn={isLoggedIn}
              onRequireSignIn={() => {
                if (typeof navStore.setTab === 'function') navStore.setTab('signup');
                else setActiveTab('signup');
              }}
              onBackToProfile={() => {
                setSelectedArtist(null);
                setInitialListenerEmail(null);
              }}
            />
          ) : (
            <>
              {activeTab === 'home' && <HomePage searchQuery={searchQuery} />}
              {activeTab === 'discover' && <DiscoverPage searchQuery={searchQuery} />}
              {activeTab === 'artists' && (
                <ArtistsPage 
                  onSelectArtist={(name) => {
                    setSelectedArtist(name);
                    setInitialListenerEmail(null);
                  }}
                  onNavigateToSignUp={() => {
                    if (typeof navStore.setTab === 'function') {
                      navStore.setTab('signup');
                    } else {
                      setActiveTab('signup');
                    }
                  }} 
                />
              )}
              {activeTab === 'signup' && (
                <SignUp 
                  onSignUpSuccess={() => {
                    setIsLoggedIn(Boolean(localStorage.getItem('currentUserEmail')));
                    setCurrentUserEmail(localStorage.getItem('currentUserEmail') || '');
                    setCurrentUserName(localStorage.getItem('currentUserName') || '');
                    setCurrentUserImage(localStorage.getItem('currentUserImage') || '');
                    if (typeof navStore.setTab === 'function') {
                      navStore.setTab('artists');
                    } else {
                      setActiveTab('artists');
                    }
                  }} 
                  onBackToHome={() => {
                    if (typeof navStore.setTab === 'function') {
                      navStore.setTab('artists');
                    } else {
                      setActiveTab('artists');
                    }
                  }} 
                />
              )}
              {activeTab === 'library' && (
                <div className="p-8 text-white">
                  <h1 className="text-3xl font-black">Your Library</h1>
                </div>
              )}
            </>
          )}
        </main>

        {/* Persistent Sticky Music Player Bar */}
        <Player />
      </div>
    </PlayerProvider>
  );
}