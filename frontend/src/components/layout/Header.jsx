import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../../config/api';

export default function Header({ 
  isLoggedIn, 
  currentUserEmail, 
  currentUserName, 
  currentUserImage, 
  searchQuery,
  onSearchChange,
  onSignOut, 
  onNavigateToSignIn, 
  onNavigateToSignUp,
  onSelectArtist
}) {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hasUnread, setHasUnread] = useState(true);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const activeEmail = (currentUserEmail || '').trim().toLowerCase();
  const activeUserName = (currentUserName || '').trim();
  // Helper to format time strings to 12‑hour with AM/PM. If already in 12‑hour format, returns unchanged.
  const formatTime12 = (timeStr) => {
    if (!timeStr) return '';
    if (/\b(AM|PM)\b/i.test(timeStr)) return timeStr;
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour}:${minute} ${ampm}`;
  };

  // Fetch real incoming messages and notifications from MongoDB backend
  useEffect(() => {
    if (!isLoggedIn || !activeEmail) {
      setNotifications([]);
      setHasUnread(false);
      return;
    }

    const checkMessages = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/notifications?user_email=${encodeURIComponent(activeEmail)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setNotifications(data);
            const unreadCount = data.filter(n => n.unread || !n.read).length;
            setHasUnread(unreadCount > 0);
            return;
          }
        }
      } catch (err) {
        console.warn("Could not fetch notifications:", err);
      }
    };

    checkMessages();
    const interval = setInterval(checkMessages, 3000);
    return () => clearInterval(interval);
  }, [isLoggedIn, activeEmail]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsMobileProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleNotifications = async () => {
    const nextState = !isNotifOpen;
    setIsNotifOpen(nextState);
    if (nextState) {
      setHasUnread(false);
      try {
        await fetch(`${API_BASE_URL}/api/notifications/clear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_email: activeEmail })
        });
      } catch (e) {}
    }
  };

  const handleNotificationClick = (n) => {
    setIsNotifOpen(false);
    if (onSelectArtist) {
      const isSenderArtist = n.sender === 'artist' || ((n.sender_name || '').toLowerCase() === (n.artist_name || '').toLowerCase());
      
      const targetArtist = isSenderArtist 
        ? (n.artist_name || n.sender_name) 
        : (n.artist_name || activeUserName);
        
      const targetListener = isSenderArtist 
        ? activeEmail 
        : (n.user_email || n.sender_email);

      onSelectArtist(targetArtist, targetListener);
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:ml-64 h-16 md:h-20 bg-[#08101a]/85 backdrop-blur-xl border-b border-white/10 z-40 px-4 sm:px-6 md:px-8 flex justify-between items-center transition-all">
      {/* Mobile Search Overlay */}
      {isMobileSearchOpen ? (
        <div className="md:hidden flex items-center w-full gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#c3c6d7]">
              <span className="material-symbols-outlined text-lg">search</span>
            </span>
            <input 
              type="text"
              autoFocus
              placeholder="Search songs, artists, genres..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#0d1825] border border-white/15 rounded-full pl-9 pr-8 py-2 text-xs text-white placeholder-[#c3c6d7] focus:outline-none focus:border-[#2563eb]"
            />
            {searchQuery && (
              <button 
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#c3c6d7] hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
          <button 
            onClick={() => setIsMobileSearchOpen(false)}
            className="text-xs text-[#c3c6d7] hover:text-white font-semibold px-2 py-1 shrink-0 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Brand Logo */}
          <div className="md:hidden inline-flex items-center shrink-0">
            <span className="text-2xl font-bold tracking-tight text-[#2563eb] whitespace-nowrap" style={{ fontWeight: 900, letterSpacing: '-0.05em' }}>
              Sway
            </span>
          </div>

          {/* Desktop Search Bar */}
          <div className="hidden md:block relative w-full max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-[#c3c6d7]">
              <span className="material-symbols-outlined text-lg">search</span>
            </span>
            <input 
              type="text"
              placeholder="Search for songs, artists, or genres..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#0d1825]/80 border border-white/10 rounded-full pl-11 pr-4 py-2.5 text-sm text-white placeholder-[#c3c6d7] focus:outline-none focus:border-[#2563eb] transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#c3c6d7] hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Right side: Auth / Profile display */}
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
            {/* Mobile Search Button */}
            <button 
              type="button"
              aria-label="Search" 
              onClick={() => setIsMobileSearchOpen(true)}
              className="md:hidden w-10 h-10 flex items-center justify-center text-[#c3c6d7] hover:text-white transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">search</span>
            </button>
            {/* Notification Bell with red indicator badge */}
            <div className="relative" ref={notifRef}>
              <button 
                type="button"
                onClick={handleToggleNotifications}
                className="relative w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-[#c3c6d7] hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
                title="Notifications"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {hasUnread && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-[#08101a] animate-pulse"></span>
                )}
              </button>

              {/* Notification Dropdown Menu */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-88 bg-[#0f1a2e]/95 backdrop-blur-2xl border border-blue-500/20 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Notifications</span>
                      <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-semibold">
                        {notifications.length} New
                      </span>
                    </div>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      <span className="material-symbols-outlined text-2xl text-slate-500 mb-1 block">notifications_off</span>
                      No new notifications
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 [scrollbar-width:none]">
                      {notifications.map((n) => {
                        const senderName = (n.sender_name || '').trim();
                        const artistName = (n.artist_name || '').trim();
                        const isArtist = n.sender === 'artist';

                        // Format sender name cleanly
                        let displaySenderName = isArtist 
                          ? (artistName || senderName || 'Artist')
                          : (senderName || n.sender_email || 'User');

                        if (displaySenderName.includes('@')) {
                          displaySenderName = displaySenderName.split('@')[0]
                            .replace(/[._-]+/g, ' ')
                            .split(' ')
                            .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '')
                            .join(' ');
                        }

                        const senderImage = n.sender_image || n.profile_pic || n.artist_image || n.user_image || '';

                        return (
                          <div 
                            key={n.id || n._id || Math.random()}
                            onClick={() => handleNotificationClick(n)}
                            className="p-3 bg-[#162238]/60 hover:bg-[#162238] border border-blue-500/10 hover:border-blue-500/30 rounded-xl transition-all cursor-pointer group flex items-start gap-3"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-600/20 ring-1 ring-blue-500/30 shrink-0 mt-0.5 flex items-center justify-center">
                              {senderImage ? (
                                <img src={senderImage} alt={displaySenderName} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[11px] font-bold text-blue-400 uppercase">
                                  {displaySenderName[0] || 'U'}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                                  {displaySenderName}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {formatTime12(n.time) || 'Just now'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                                {n.text}
                              </p>
                              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-400 font-semibold">
                                <span>Open conversation</span>
                                <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Info Section */}
            {isLoggedIn ? (
              <div className="relative" ref={profileRef}>
                {(() => {
                  const storedImg = localStorage.getItem('currentUserImage') || '';
                  const resolvedImg = currentUserImage || storedImg;
                  const storedName = localStorage.getItem('currentUserName') || '';
                  const rawName = (currentUserName || storedName || '').trim();
                  const fallbackFromEmail = currentUserEmail 
                    ? currentUserEmail.split('@')[0].replace(/[._-]+/g, ' ').split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ')
                    : 'User';
                  const displayHeaderName = (rawName && rawName.toLowerCase() !== 'user') ? rawName : fallbackFromEmail;
                  const initials = displayHeaderName
                    .split(' ')
                    .filter(Boolean)
                    .map(w => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || (currentUserEmail ? currentUserEmail[0].toUpperCase() : 'U');

                  return (
                    <>
                      {/* Desktop Profile Card */}
                      <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
                        {resolvedImg ? (
                          <img 
                            src={resolvedImg} 
                            alt={displayHeaderName} 
                            className="w-8 h-8 rounded-full object-cover border border-white/20 shadow-sm"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div 
                          className="w-8 h-8 rounded-full bg-[#2563eb] items-center justify-center text-white font-bold text-xs shadow-sm"
                          style={{ display: resolvedImg ? 'none' : 'flex' }}
                        >
                          {initials}
                        </div>

                        <div className="hidden sm:block text-left">
                          <p className="text-xs font-bold text-white leading-tight truncate max-w-[140px]">
                            {displayHeaderName}
                          </p>
                        </div>

                        <button 
                          onClick={onSignOut}
                          className="ml-2 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer"
                        >
                          Sign Out
                        </button>
                      </div>

                      {/* Mobile Profile Avatar Button */}
                      <button 
                        type="button"
                        aria-label="Profile"
                        onClick={() => setIsMobileProfileOpen(!isMobileProfileOpen)}
                        className="md:hidden w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden border border-white/15 cursor-pointer active:scale-95 transition-transform"
                        title={displayHeaderName}
                      >
                        {resolvedImg ? (
                          <img src={resolvedImg} alt={displayHeaderName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-[18px]">person</span>
                        )}
                      </button>

                      {/* Mobile Profile Dropdown */}
                      {isMobileProfileOpen && (
                        <div className="md:hidden absolute right-0 mt-3 w-48 bg-[#0f1a2e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                          <div className="pb-2 mb-2 border-b border-white/10">
                            <p className="text-xs font-bold text-white truncate">{displayHeaderName}</p>
                          </div>
                          <button
                            onClick={() => {
                              setIsMobileProfileOpen(false);
                              onSignOut && onSignOut();
                            }}
                            className="w-full text-left text-xs text-red-400 hover:text-red-300 py-1.5 flex items-center gap-1.5 font-semibold cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">logout</span>
                            <span>Sign Out</span>
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={onNavigateToSignIn}
                  className="text-xs font-bold text-[#c3c6d7] hover:text-white px-3 py-1.5 md:px-4 md:py-2 transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button 
                  onClick={onNavigateToSignUp}
                  className="text-xs font-bold bg-[#2563eb] text-white px-3.5 py-1.5 md:px-5 md:py-2.5 rounded-full hover:bg-blue-600 transition-colors shadow-lg shadow-[#2563eb]/20 cursor-pointer"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}