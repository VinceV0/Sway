import React, { useState, useEffect, useRef, useMemo } from 'react';
import { API_BASE_URL } from '../../config/api';

export default function ArtistChat({ 
  artistName: initialArtistName, 
  artistImage: initialArtistImage, 
  onBackToProfile, 
  currentUser,
  isLoggedIn,
  onRequireSignIn,
  initialListenerEmail
}) {
  const storedEmail = localStorage.getItem('currentUserEmail') || '';
  const storedName = localStorage.getItem('currentUserName') || '';
  const storedImage = localStorage.getItem('currentUserImage') || '';
  const storedRole = localStorage.getItem('currentUserRole') || '';

  const activeEmail = (currentUser?.email || storedEmail || '').trim().toLowerCase();
  const activeUserName = currentUser?.name || currentUser?.artist_name || storedName || activeEmail || 'Listener';
  const activeUserImage = currentUser?.image || currentUser?.profile_pic || storedImage || '';
  const activeUserRole = (currentUser?.role || storedRole || '').trim().toLowerCase();

  // Persistent guest email fallback
  const [persistentGuestEmail] = useState(() => {
    let email = localStorage.getItem('sway_guest_email');
    if (!email) {
      email = `guest_${Math.random().toString(36).substring(2, 9)}@swaymusic.com`;
      localStorage.setItem('sway_guest_email', email);
    }
    return email;
  });

  const myEmail = activeEmail || persistentGuestEmail;

  // Active chat state
  const [activeArtistName, setActiveArtistName] = useState(initialArtistName || '');
  const [activeArtistImage, setActiveArtistImage] = useState(initialArtistImage || '');
  const [selectedListenerEmail, setSelectedListenerEmail] = useState(() => {
    if (initialListenerEmail) return initialListenerEmail.trim().toLowerCase();
    return '';
  });

  // Conversations list from backend
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState('chat'); // 'list' | 'chat'

  // Messages in active conversation
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const chatStreamRef = useRef(null);

  // Sync props if initialArtistName or initialListenerEmail changes from parent
  useEffect(() => {
    if (initialArtistName) {
      setActiveArtistName(initialArtistName);
    }
    if (initialArtistImage) {
      setActiveArtistImage(initialArtistImage);
    }
    if (initialListenerEmail) {
      setSelectedListenerEmail(initialListenerEmail.trim().toLowerCase());
    }
    setMobileView('chat');
  }, [initialArtistName, initialArtistImage, initialListenerEmail]);

  // If activeArtistImage is missing, resolve it from artists list
  useEffect(() => {
    if (!activeArtistImage && activeArtistName) {
      fetch(`${API_BASE_URL}/api/artists`)
        .then(res => res.json())
        .then(artists => {
          if (Array.isArray(artists)) {
            const found = artists.find(a => 
              (a.name || a.artist_name || '').toLowerCase() === activeArtistName.toLowerCase()
            );
            if (found && (found.image || found.image_url || found.profile_pic)) {
              setActiveArtistImage(found.image || found.image_url || found.profile_pic);
            }
          }
        })
        .catch(() => {});
    }
  }, [activeArtistName, activeArtistImage]);

  // Determine if current logged-in user is the artist of active chat
  const artistCleanName = (activeArtistName || '').trim().toLowerCase();
  const activeUserCleanName = activeUserName.trim().toLowerCase();
  const isCurrentUserThisArtist = 
    (activeUserCleanName && activeUserCleanName === artistCleanName) ||
    (activeEmail && activeEmail === artistCleanName) ||
    (activeUserRole === 'artist' && (currentUser?.artist_name || '').trim().toLowerCase() === artistCleanName);

  const artistSlug = (activeArtistName || 'artist').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const currentChatTargetEmail = isCurrentUserThisArtist 
    ? (selectedListenerEmail || 'all') 
    : (activeEmail || persistentGuestEmail);
  
  const cacheKey = `artist_chat_${artistSlug}_${currentChatTargetEmail}`;

  // Helper to format time strings to 12‑hour with AM/PM. If already in 12‑hour format (contains AM/PM), returns unchanged.
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

  const parseMessageTimestamp = (msg) => {
    if (msg.timestamp) {
      const t = new Date(msg.timestamp).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (msg.created_at) {
      const t = new Date(msg.created_at).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (msg._id && typeof msg._id === 'string' && msg._id.length >= 8) {
      const t = parseInt(msg._id.substring(0, 8), 16) * 1000;
      if (!isNaN(t) && t > 0) return t;
    }
    if (msg.id && typeof msg.id === 'string' && msg.id.startsWith('local-')) {
      const t = parseInt(msg.id.replace('local-', ''), 10);
      if (!isNaN(t) && t > 0) return t;
    }
    return 0;
  };

  // Fetch all user conversations
  const fetchConversations = async () => {
    if (!myEmail) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/user/${encodeURIComponent(myEmail)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setConversations(data);
          
          // If no active artist is selected yet, select the first conversation
          if (!activeArtistName && data.length > 0) {
            const first = data[0];
            setActiveArtistName(first.artist_name);
            setActiveArtistImage(first.other_image || '');
            if (first.is_artist_view) {
              setSelectedListenerEmail(first.listener_email);
            } else {
              setSelectedListenerEmail(myEmail);
            }
          }

          // If artist is viewing own chat but no listener thread is selected yet,
          // auto-pick the first fan thread to avoid showing mixed/empty messages
          if (isCurrentUserThisArtist && activeArtistName && !selectedListenerEmail) {
            const fanThread = data.find(c =>
              c.artist_name.toLowerCase() === activeArtistName.toLowerCase() &&
              c.is_artist_view &&
              c.listener_email
            );
            if (fanThread) {
              setSelectedListenerEmail(fanThread.listener_email);
              if (!activeArtistImage) setActiveArtistImage(fanThread.other_image || '');
            }
          }
        }
      }
    } catch (err) {
      console.warn("Error fetching user conversations:", err);
    } finally {
      setConversationsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, [myEmail]);

  // Load cached messages on mount / thread change
  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn("Could not read local chat cache:", e);
    }
  }, [cacheKey]);

  // Fetch active conversation message stream
  const fetchMessages = async () => {
    if (!activeArtistName) {
      setLoading(false);
      return;
    }

    // Determine the correct target email for this thread
    const targetEmail = isCurrentUserThisArtist
      ? selectedListenerEmail
      : (activeEmail || persistentGuestEmail);

    // Artist opened chat but no fan thread selected yet — bail to avoid showing mixed messages
    if (isCurrentUserThisArtist && !targetEmail) {
      setLoading(false);
      return;
    }

    try {
      const artistParam = encodeURIComponent(activeArtistName);
      // Pass user_email to the server so it filters at the DB level — prevents mixing messages from different fans
      const emailQP = targetEmail ? `?user_email=${encodeURIComponent(targetEmail)}` : '';
      const res = await fetch(`${API_BASE_URL}/api/artists/${artistParam}/messages${emailQP}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Secondary client-side guard — absolutely ensure no cross-user messages slip through
          const filteredData = targetEmail
            ? data.filter(m => m.user_email && m.user_email.toLowerCase() === targetEmail.toLowerCase())
            : data;

          setMessages((prev) => {
            const existingIds = new Set(filteredData.map(m => m.id || m._id));
            // Only keep local-only pending messages not yet confirmed by server
            const pendingLocal = prev.filter(p =>
              (p.id || '').startsWith('local-') &&
              !existingIds.has(p.id) &&
              !existingIds.has(p._id)
            );
            const combined = [...filteredData, ...pendingLocal].sort((a, b) =>
              parseMessageTimestamp(a) - parseMessageTimestamp(b)
            );
            try {
              localStorage.setItem(cacheKey, JSON.stringify(combined));
            } catch (e) {}
            return combined;
          });
        }
      }
    } catch (err) {
      console.warn("Error fetching chat messages:", err);
    } finally {
      setLoading(false);
    }
  };

  // Clear messages immediately when switching threads to prevent stale data from another user flashing
  useEffect(() => {
    setMessages([]);
    setLoading(true);
  }, [activeArtistName, selectedListenerEmail]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2500);
    return () => clearInterval(interval);
  }, [activeArtistName, selectedListenerEmail, isCurrentUserThisArtist, myEmail]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Combined list of conversation items (including placeholder for newly initiated chat)
  const displayConversations = useMemo(() => {
    let list = [...conversations];

    // If there is an activeArtistName that is not yet in conversations list, prepend it
    if (activeArtistName) {
      const exists = list.some(c => 
        c.artist_name.toLowerCase() === activeArtistName.toLowerCase() &&
        (isCurrentUserThisArtist 
          ? (selectedListenerEmail && c.listener_email && c.listener_email.toLowerCase() === selectedListenerEmail.toLowerCase()) 
          : true)
      );

      if (!exists) {
        list.unshift({
          id: `draft_${activeArtistName}`,
          artist_name: activeArtistName,
          listener_email: selectedListenerEmail || myEmail,
          is_artist_view: isCurrentUserThisArtist,
          other_name: activeArtistName,
          other_image: activeArtistImage,
          other_role: isCurrentUserThisArtist ? 'listener' : 'artist',
          last_message: 'Start a conversation...',
          last_time: 'Now',
          timestamp: new Date().toISOString(),
          unread: false
        });
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => 
        c.other_name?.toLowerCase().includes(q) ||
        c.artist_name?.toLowerCase().includes(q) ||
        c.last_message?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [conversations, activeArtistName, activeArtistImage, selectedListenerEmail, isCurrentUserThisArtist, myEmail, searchQuery]);

  const handleSelectConversation = (conv) => {
    setActiveArtistName(conv.artist_name);
    setActiveArtistImage(conv.other_image || '');
    if (conv.is_artist_view) {
      setSelectedListenerEmail(conv.listener_email);
    } else {
      setSelectedListenerEmail(myEmail);
    }
    setMobileView('chat');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !activeArtistName) return;

    if (!isLoggedIn && onRequireSignIn) {
      onRequireSignIn();
      return;
    }

    const chatUserEmail = isCurrentUserThisArtist
      ? (selectedListenerEmail || myEmail)
      : (activeEmail || persistentGuestEmail);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const senderRole = isCurrentUserThisArtist ? 'artist' : 'user';

    const newMsg = {
      id: `local-${Date.now()}`,
      sender: senderRole,
      sender_name: isCurrentUserThisArtist ? (activeArtistName || activeUserName) : activeUserName,
      sender_image: activeUserImage,
      profile_pic: activeUserImage,
      text,
      time: timeStr,
      user_email: chatUserEmail,
      artist_name: activeArtistName,
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    // Clear input; rely on polling to show the new message
    setInputText('');
    try {
      const artistParam = encodeURIComponent(activeArtistName);
      await fetch(`${API_BASE_URL}/api/artists/${artistParam}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg)
      });
      fetchConversations();
    } catch (err) {
      console.error('Backend chat save error:', err);
    }
  };

  // Active chat header display info
  const activeConv = activeArtistName ? conversations.find(c => 
    c.artist_name.toLowerCase() === activeArtistName.toLowerCase() &&
    (isCurrentUserThisArtist 
      ? (selectedListenerEmail && c.listener_email && c.listener_email.toLowerCase() === selectedListenerEmail.toLowerCase())
      : true)
  ) : null;

  const activeHeaderName = isCurrentUserThisArtist 
    ? (activeConv?.other_name || (selectedListenerEmail ? selectedListenerEmail.split('@')[0] : 'Fan'))
    : (activeArtistName || 'Artist');

  const activeHeaderImage = isCurrentUserThisArtist 
    ? (activeConv?.other_image || '')
    : (activeArtistImage || activeConv?.other_image || '');

  return (
    <main className="relative w-full pt-4 min-h-[calc(100vh-80px)] bg-[#08101a] pb-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-[calc(100vh-120px)] min-h-[580px] flex gap-4">
        
        {/* ================= LEFT SIDEBAR: ALL OPEN CONVERSATIONS ================= */}
        <div className={`w-full md:w-80 lg:w-96 flex flex-col bg-[#0d1825]/90 backdrop-blur-xl rounded-2xl border border-blue-500/20 shadow-2xl overflow-hidden transition-all ${
          mobileView === 'list' ? 'flex' : 'hidden md:flex'
        }`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-blue-500/15 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button 
                onClick={onBackToProfile}
                type="button"
                className="w-8 h-8 rounded-xl bg-[#162238] hover:bg-[#1f3050] text-slate-300 hover:text-white border border-blue-500/10 flex items-center justify-center transition-colors cursor-pointer"
                title="Back"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">Conversations</h2>
                <p className="text-[11px] text-blue-400/80 font-medium">
                  {conversations.length} active {conversations.length === 1 ? 'chat' : 'chats'}
                </p>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-600/20 ring-1 ring-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 uppercase">
              {activeUserImage ? (
                <img src={activeUserImage} alt={activeUserName} className="w-full h-full object-cover" />
              ) : (
                <span>{activeUserName[0] || 'U'}</span>
              )}
            </div>
          </div>

          {/* Search Conversations */}
          <div className="p-3 border-b border-blue-500/10">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-[17px]">search</span>
              </span>
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#08101a] text-xs text-white placeholder:text-slate-500 pl-9 pr-3 py-2 rounded-xl border border-blue-500/20 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-blue-500/5 [scrollbar-width:thin]">
            {conversationsLoading && displayConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
                Loading chats...
              </div>
            ) : displayConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <span className="material-symbols-outlined text-3xl text-slate-500 mb-2 block">forum</span>
                No conversations yet.
                <p className="text-[11px] text-slate-500 mt-1">Start chatting with an artist!</p>
              </div>
            ) : (
              displayConversations.map((conv) => {
                const isSelected = 
                  conv.artist_name.toLowerCase() === activeArtistName.toLowerCase() &&
                  (isCurrentUserThisArtist 
                    ? (selectedListenerEmail && conv.listener_email && conv.listener_email.toLowerCase() === selectedListenerEmail.toLowerCase()) 
                    : true);

                const displayName = conv.other_name || conv.artist_name || 'Artist';
                const displayImg = conv.other_image || '';
                const roleBadge = conv.other_role === 'artist' ? 'Artist' : 'Fan';

                return (
                  <div
                    key={conv.id || conv.artist_name + conv.listener_email}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:bg-[#162238]/60 ${
                      isSelected 
                        ? 'bg-blue-600/15 border-l-4 border-l-blue-500 shadow-inner' 
                        : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold uppercase shadow-md ${
                        isSelected ? 'ring-2 ring-blue-400 bg-blue-600' : 'ring-1 ring-blue-500/20 bg-[#162238]'
                      }`}>
                        {displayImg ? (
                          <img src={displayImg} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className={isSelected ? 'text-white' : 'text-blue-400'}>
                            {displayName[0] || 'U'}
                          </span>
                        )}
                      </div>
                      {conv.unread && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 ring-2 ring-[#0d1825] rounded-full"></span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                            {displayName}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold ${
                            conv.other_role === 'artist'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {roleBadge}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                          {formatTime12(conv.last_time)}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate ${conv.unread ? 'text-blue-300 font-semibold' : 'text-slate-400'}`}>
                        {conv.last_message || 'Tap to view chat'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= RIGHT PANEL: ACTIVE CONVERSATION ================= */}
        <div className={`flex-1 flex flex-col bg-[#0d1825]/90 backdrop-blur-xl rounded-2xl border border-blue-500/20 shadow-2xl overflow-hidden ${
          mobileView === 'chat' ? 'flex' : 'hidden md:flex'
        }`}>
          {/* Active Chat Header */}
          <div className="bg-[#0f1a2e]/95 px-4 py-3 border-b border-blue-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile button to switch back to conversations list */}
              <button 
                onClick={() => setMobileView('list')}
                type="button"
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl bg-[#162238] text-slate-300 hover:text-white border border-blue-500/10 cursor-pointer"
                title="All Chats"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>

              <button 
                onClick={onBackToProfile}
                type="button"
                className="hidden md:flex items-center gap-1.5 text-slate-300 hover:text-blue-400 transition-colors py-1.5 px-3 rounded-xl bg-[#162238]/60 hover:bg-[#162238] border border-blue-500/10 cursor-pointer text-xs font-semibold shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back</span>
              </button>

              <div className="h-6 w-px bg-slate-700/40 hidden md:block"></div>

              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#162238] ring-1 ring-blue-500/30 flex items-center justify-center shadow-md">
                    {activeHeaderImage ? (
                      <img className="w-full h-full object-cover" alt={activeHeaderName} src={activeHeaderImage} />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-blue-900 to-indigo-700 flex items-center justify-center text-white font-bold text-xs">
                        {activeHeaderName[0] || 'A'}
                      </div>
                    )}
                  </div>
                  
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-white font-bold truncate">{activeHeaderName}</span>
                    <span className="material-symbols-outlined text-blue-400 text-[16px]">verified</span>
                    <span className="bg-blue-500/20 text-blue-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      {isCurrentUserThisArtist ? 'Fan Thread' : 'Direct Artist Chat'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div 
            ref={chatStreamRef}
            id="chat-stream"
            className="flex-1 overflow-y-auto p-4 space-y-4 [scrollbar-width:thin]"
          >
            <div className="text-center my-2">
              <span className="text-[11px] text-slate-400 px-3.5 py-1.5 bg-[#162238] rounded-full border border-blue-900/40 font-medium">
                {isCurrentUserThisArtist 
                  ? `Conversation with ${activeHeaderName}` 
                  : `Direct conversation with ${activeArtistName}`}
              </span>
            </div>

            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <div className="w-12 h-12 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2">
                  <span className="material-symbols-outlined text-2xl">chat</span>
                </div>
                <p className="text-xs text-slate-300 font-medium">No messages in this conversation yet</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                  {isCurrentUserThisArtist 
                    ? `Send a message to reply to ${activeHeaderName}.`
                    : `Send a message below to reach out directly to ${activeArtistName}.`}
                </p>
              </div>
            )}

            {messages.map((msg) => {
              // Determine if this message was sent by the currently logged-in user
              const isMe = isCurrentUserThisArtist
                // Artist view: artist's own messages have sender === 'artist'
                ? (msg.sender === 'artist')
                // Listener view: their own messages have sender === 'user' AND user_email matches their email
                : (msg.sender === 'user' && msg.user_email && activeEmail &&
                    msg.user_email.toLowerCase() === activeEmail.toLowerCase());

              // Avatar for the "incoming" (other party) side — prefer per-message image from server
              const incomingAvatar = msg.sender_image || msg.profile_pic ||
                (isCurrentUserThisArtist
                  ? (activeConv?.other_image || '')
                  : (activeArtistImage || activeConv?.other_image || ''));

              // Display name for incoming messages — clean up email addresses if needed
              const rawMsgSenderName = msg.sender_name || (isCurrentUserThisArtist ? 'Fan' : activeArtistName);
              const displayMsgSenderName = rawMsgSenderName.includes('@')
                ? rawMsgSenderName.split('@')[0].replace(/[._-]+/g, ' ').split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ')
                : (rawMsgSenderName === 'You' && !isMe
                    ? (activeHeaderName || rawMsgSenderName)
                    : rawMsgSenderName);

              // "You" label for your own messages — use your actual username
              const myDisplayName = isCurrentUserThisArtist ? activeArtistName : activeUserName;

              return (
                <div 
                  key={msg.id || msg._id || Math.random()} 
                  className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                >
                  {isMe ? (
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5 shadow-md uppercase ring-1 ring-blue-400/30">
                      {activeUserImage ? (
                        <img src={activeUserImage} alt={myDisplayName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(myDisplayName || 'U').slice(0, 2)}</span>
                      )}
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 mt-0.5 ring-1 ring-blue-500/20 bg-[#162238] flex items-center justify-center shadow-sm">
                      {incomingAvatar ? (
                        <img className="w-full h-full object-cover" alt={displayMsgSenderName} src={incomingAvatar} />
                      ) : (
                        <div className="w-full h-full bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-bold uppercase">
                          {displayMsgSenderName[0] || 'U'}
                        </div>
                      )}
                    </div>
                  )}

              <div className="flex-1 max-w-[80%]">
                    <div className={`flex items-baseline gap-1.5 mb-1 ${isMe ? 'justify-end' : ''}`}>
                      <span className="text-xs text-white font-semibold">
                        {isMe ? myDisplayName : displayMsgSenderName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatTime12(msg.time)}
                      </span>
                    </div>
                    <div 
                      className={`p-3.5 rounded-2xl font-normal text-xs sm:text-sm shadow-md leading-relaxed ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-tr-xs' 
                          : 'bg-[#162238] border border-blue-500/15 text-slate-100 rounded-tl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Message Input Footer */}
          <div className="p-3.5 bg-[#0f1a2e]/95 border-t border-blue-500/20">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input 
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={!activeArtistName ? "Select a conversation to chat..." : `Message ${activeHeaderName}...`}
                disabled={!activeArtistName}
                autoComplete="off"
                className="flex-1 bg-[#08101a] py-2.5 px-4 rounded-xl text-slate-200 placeholder:text-slate-500 text-xs sm:text-sm border border-blue-500/20 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
              />
              <button 
                type="submit"
                disabled={!inputText.trim() || !activeArtistName}
                className="px-5 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:brightness-110 shadow-lg shadow-blue-600/30 transition-all flex-shrink-0 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>

      </div>
    </main>
  );
}