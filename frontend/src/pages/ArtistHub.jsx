import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config/api';
import ArtistChat from '../components/chat/ArtistChat';

export default function ArtistHub({ 
  artistName, 
  onBack, 
  onPlayTrack, 
  isLoggedIn, 
  likedTrackIds = [], 
  onToggleLike, 
  onAddToPlaylist, 
  onRequireSignIn,
  followedArtistNames = [],
  onToggleFollowArtist,
  isArtistOwner = false,
  currentUser = null,
  initialOpenChat = false,
  initialListenerEmail = null,
  onOpenChat = null
}) {
  const [artistData, setArtistData] = useState(null);
  const [artistTracks, setArtistTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(initialOpenChat);

  useEffect(() => {
    setIsChatOpen(Boolean(initialOpenChat));
  }, [initialOpenChat, artistName]);
  const [postText, setPostText] = useState("");
  const [customTags, setCustomTags] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Studio Update");
  const [selectedBadgeClass, setSelectedBadgeClass] = useState("text-blue-400 bg-blue-600/10 border-blue-600/20");
  const carouselRef = useRef(null);

  const [artistPosts, setArtistPosts] = useState([]);

  useEffect(() => {
    setLoading(true);

    const cleanTarget = (artistName || "").replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // 1. Fetch artists collection from backend
    fetch(`${API_BASE_URL}/api/artists`)
      .then(res => res.json())
      .then(data => {
        const artistList = Array.isArray(data) ? data : (data.artists || data.data || []);
        
        const found = artistList.find(a => {
          const aName = (a.name || a.artist_name || a.artist || "").replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          return aName === cleanTarget || (a.email && a.email.toLowerCase() === (artistName || '').toLowerCase());
        });

        if (found) {
          setArtistData(found);
        }
      })
      .catch(err => console.error("Error fetching artists collection:", err));

    // 2. Fetch tracks collection to populate discography
    fetch(`${API_BASE_URL}/api/tracks`)
      .then(res => res.json())
      .then(data => {
        const trackList = Array.isArray(data) ? data : (data.tracks || data.data || []);
        const filtered = trackList.filter(t => {
          const tArtist = (t.artist_name || t.artist || "").replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          return tArtist === cleanTarget || tArtist.includes(cleanTarget) || cleanTarget.includes(tArtist);
        });
        setArtistTracks(filtered);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading tracks:", err);
        setLoading(false);
      });
  }, [artistName]);

  // Fetch artist posts directly from MongoDB using artistName immediately on load/change
  useEffect(() => {
    if (!artistName) return;

    fetch(`${API_BASE_URL}/api/artists/${encodeURIComponent(artistName)}/posts`)
      .then(res => res.json())
      .then(data => {
        const postList = Array.isArray(data) ? data : (data.posts || data.data || []);
        setArtistPosts(postList);
      })
      .catch(err => console.error("Error fetching artist posts:", err));
  }, [artistName]);

  const artistImage =
    artistData?.profile_pic || 
    artistData?.image_url || 
    artistData?.imageUrl || 
    artistData?.image || 
    artistData?.cover_art_url || 
    artistData?.avatar || 
    artistTracks.find(t => t.cover_art_url || t.image_url)?.cover_art_url || 
    artistTracks[0]?.cover_art_url || 
    null;

  const artistBio =
    artistData?.bio || 
    artistData?.description || 
    "";

  // Robust ownership evaluation matching currentUser across names, emails, and database references
  const storedName = localStorage.getItem('currentUserName') || '';
  const storedEmail = localStorage.getItem('currentUserEmail') || '';
  const activeUserEmail = (currentUser?.email || storedEmail || '').trim().toLowerCase();
  const activeUserName = (currentUser?.name || currentUser?.artist_name || storedName || '').trim().toLowerCase();
  const targetArtistName = (artistName || '').trim().toLowerCase();
  const targetArtistEmail = (artistData?.email || '').trim().toLowerCase();

  const effectiveIsOwner = isArtistOwner || (isLoggedIn && (
    (activeUserName && targetArtistName && activeUserName === targetArtistName) ||
    (activeUserEmail && targetArtistEmail && activeUserEmail === targetArtistEmail) ||
    (artistData && (
      (currentUser?.artist_id && (currentUser.artist_id === artistData._id || currentUser.artist_id === artistData.id)) ||
      (currentUser?.id && (currentUser.id === artistData.user_id || currentUser.id === artistData.artist_id))
    ))
  ));

  const [draftSavedToast, setDraftSavedToast] = useState(false);

  // Load draft from localStorage if available
  useEffect(() => {
    if (effectiveIsOwner && artistName) {
      const savedDraft = localStorage.getItem(`artist_draft_${artistName}`);
      if (savedDraft) {
        setPostText(savedDraft);
      }
      const savedTags = localStorage.getItem(`artist_draft_tags_${artistName}`);
      if (savedTags) {
        setCustomTags(savedTags);
      }
    }
  }, [effectiveIsOwner, artistName]);

  const handleSaveDraft = () => {
    if (!postText.trim() && !customTags.trim()) return;
    if (artistName) {
      localStorage.setItem(`artist_draft_${artistName}`, postText);
      localStorage.setItem(`artist_draft_tags_${artistName}`, customTags);
    }
    setDraftSavedToast(true);
    setTimeout(() => setDraftSavedToast(false), 2500);
  };

  const isFollowed = followedArtistNames.includes(artistName);

  const formatTime = (secs) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: direction * 320, behavior: 'smooth' });
    }
  };

  const handleCategorySelect = (cat, badgeClass) => {
    setSelectedCategory(cat);
    setSelectedBadgeClass(badgeClass);
  };

  const displayedPosts = artistPosts;

  // Allow the authenticated artist owner to publish a new dynamic post directly to MongoDB via artistName
  const handlePublishPost = async () => {
    if (!postText.trim()) return;

    // Format hashtags correctly (ensure they start with # if user forgot)
    const formattedTags = customTags.trim() 
      ? customTags.split(/\s+/)
          .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
          .join(' ')
      : `#${artistName ? artistName.replace(/\s+/g, '') : 'Artist'} #${selectedCategory.replace(/\s+/g, '')}`;

    const newPost = {
      text: postText.trim(),
      tag: selectedCategory,
      category: selectedCategory,
      tagColor: selectedBadgeClass,
      time: "Just now",
      tags: formattedTags,
      createdAt: new Date().toISOString(),
      author: currentUser?.name || artistName || 'Artist',
      artist_name: artistName,
    };

    // Clean stored drafts
    if (artistName) {
      localStorage.removeItem(`artist_draft_${artistName}`);
      localStorage.removeItem(`artist_draft_tags_${artistName}`);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/artists/${encodeURIComponent(artistName)}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPost)
      });

      if (response.ok) {
        const savedPost = await response.json();
        setArtistPosts(prev => [savedPost, ...prev]);
        setPostText("");
        setCustomTags("");
        return;
      }
    } catch (err) {
      console.warn("Backend artist post save fallback to local state:", err);
    }

    // Optimistic state update
    setArtistPosts(prev => [{ id: Date.now().toString(), ...newPost }, ...prev]);
    setPostText("");
    setCustomTags("");
  };

  // Allow the artist owner to delete a post
  const handleDeletePost = async (postId) => {
    setArtistPosts(prev => prev.filter(p => (p.id !== postId && p._id !== postId)));

    try {
      await fetch(`${API_BASE_URL}/api/artists/${encodeURIComponent(artistName)}/posts/${postId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn("Backend artist post delete error fallback:", err);
    }
  };

  if (isChatOpen) {
    const rawListener = (initialListenerEmail && initialListenerEmail.toLowerCase() !== activeUserEmail) 
      ? initialListenerEmail 
      : null;
    const targetListenerEmail = rawListener || (!effectiveIsOwner ? (activeUserEmail || currentUser?.email || localStorage.getItem('currentUserEmail')) : null);
    return (
      <ArtistChat 
        artistName={artistName} 
        artistImage={artistImage} 
        onBackToProfile={() => setIsChatOpen(false)} 
        currentUser={currentUser}
        isLoggedIn={isLoggedIn}
        onRequireSignIn={onRequireSignIn}
        initialListenerEmail={targetListenerEmail}
      />
    );
  }

  return (
    <>
      <style>{`
        .hero-banner-bg {
          background: linear-gradient(180deg, rgba(8, 14, 28, 0.4) 0%, rgba(6, 11, 22, 0.95) 100%), 
                      radial-gradient(ellipse at center, rgba(168, 85, 247, 0.08) 0%, rgba(13, 21, 38, 0.8) 70%),
                      #0a1122;
          position: relative;
          overflow: hidden;
        }
      `}</style>

      <div className="flex-1 flex flex-col min-w-0 bg-[#060a14] overflow-y-auto pb-24">
        <main className="flex-1 px-8 pt-4 max-w-7xl w-full mx-auto">
          {/* Back Button */}
          <div className="mb-5">
            <button 
              onClick={onBack}
              className="inline-flex items-center gap-2 bg-[#0c1629] hover:bg-[#12213d] border border-[#1a2d54] text-slate-300 text-xs font-medium px-4 py-1.5 rounded-md transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
              <span>Back</span>
            </button>
          </div>

          {/* Artist Hero Banner */}
          <section className="hero-banner-bg rounded-2xl border border-[#14223f] p-8 md:p-10 mb-8 shadow-2xl relative min-h-[220px] flex items-end">
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between w-full gap-6 relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-black border border-slate-700 shadow-2xl shrink-0 flex flex-col justify-center items-center relative group">
                  {artistImage ? (
                    <img className="w-full h-full object-cover" src={artistImage} alt={artistName} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-t from-black via-zinc-900 to-zinc-800 flex flex-col items-center justify-center p-2 text-center">
                      <span className="text-amber-500 font-black text-sm tracking-wider uppercase">
                        {artistName || 'ARTIST'}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-blue-400 text-[11px] font-bold tracking-wider mb-1 uppercase">
                    <svg className="w-4 h-4 fill-blue-500 text-black" viewBox="0 0 24 24">
                      <path clipRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307a4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397a4.491 4.491 0 01-1.307 3.497a4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306a4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497a4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" fillRule="evenodd"></path>
                    </svg>
                    <span>Verified Artist</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">{artistName || "Unknown Artist"}</h1>
                  {artistBio && (
                    <p className="text-xs text-slate-300 mt-2 max-w-xl line-clamp-2">
                      {artistBio}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="shrink-0 self-end flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    if (!isLoggedIn && onRequireSignIn) {
                      onRequireSignIn();
                      return;
                    }
                    const targetListener = !effectiveIsOwner 
                      ? (activeUserEmail || currentUser?.email || localStorage.getItem('currentUserEmail')) 
                      : null;
                    if (onOpenChat) {
                      onOpenChat(artistName, targetListener);
                    } else {
                      setIsChatOpen(true);
                    }
                  }}
                  className="flex items-center gap-2 bg-[#0c1629] hover:bg-[#12213d] border border-[#1a2d54] hover:border-slate-700 text-slate-200 hover:text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-lg transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                  </svg>
                  <span>Chat with artist</span>
                </button>

                {!effectiveIsOwner && (
                  <button
                    onClick={() => {
                      if (!isLoggedIn && onRequireSignIn) {
                        onRequireSignIn();
                        return;
                      }
                      if (onToggleFollowArtist) onToggleFollowArtist(artistName);
                    }}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-xs transition-all cursor-pointer shadow-lg hover:scale-[1.02] ${
                      isFollowed 
                        ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                    <span>{isFollowed ? 'Following' : 'Follow'}</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Discography & Popular Tracks Section */}
          <section data-purpose="discography-listing" className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Discography &amp; Popular Tracks</h2>
                <span className="text-xs text-blue-400 bg-blue-600/10 border border-blue-600/20 px-2.5 py-0.5 rounded-full font-medium">
                  {artistTracks.length} Tracks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => scrollCarousel(-1)} 
                  className="w-9 h-9 rounded-full bg-[#0c1629] hover:bg-[#12213d] border border-[#1a2d54] hover:border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer" 
                  title="Scroll Left" 
                  aria-label="Previous Tracks"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path>
                  </svg>
                </button>
                <button 
                  onClick={() => scrollCarousel(1)} 
                  className="w-9 h-9 rounded-full bg-[#0c1629] hover:bg-[#12213d] border border-[#1a2d54] hover:border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer" 
                  title="Scroll Right" 
                  aria-label="Next Tracks"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"></path>
                  </svg>
                </button>
              </div>
            </div>

            {loading ? (
              <p className="text-slate-400 text-sm">Loading artist profile...</p>
            ) : artistTracks.length === 0 ? (
              <p className="text-slate-400 text-sm">No tracks found for this artist.</p>
            ) : (
              <div 
                id="tracks-carousel" 
                ref={carouselRef}
                className="flex flex-row overflow-x-auto gap-4 items-center pb-3 pt-1 scroll-smooth select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {artistTracks.map((track, idx) => {
                  const trackId = track._id || track.id || idx.toString();
                  const isLiked = likedTrackIds.includes(trackId);

                  return (
                    <div 
                      key={trackId}
                      onClick={() => onPlayTrack(track, artistTracks)}
                      className="group shrink-0 flex items-center gap-3.5 bg-[#0a1020]/90 hover:bg-[#0e172d] border border-[#15213b] hover:border-blue-500/50 rounded-full px-4 py-2.5 transition-all shadow-lg hover:shadow-blue-600/10 cursor-pointer min-w-[270px]"
                    >
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-black via-zinc-900 to-zinc-800 border border-slate-700/60 overflow-hidden flex flex-col items-center justify-center shrink-0 relative group-hover:scale-105 transition-transform">
                        <img 
                          className="w-full h-full object-cover" 
                          src={track.cover_art_url || artistImage} 
                          alt={track.title} 
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                          {track.title}
                        </h4>
                        <p className="text-xs text-slate-400 truncate">
                          {artistName} • {track.album_name || "Single"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            if (!isLoggedIn && onRequireSignIn) {
                              onRequireSignIn();
                              return;
                            }
                            if (onToggleLike) onToggleLike(trackId);
                          }}
                          className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                          title={isLoggedIn ? (isLiked ? "Remove from Favourites" : "Add to Favourites") : "Sign in to favourite"}
                        >
                          <span className={`material-symbols-outlined text-base ${isLiked ? 'fill-1 text-red-500' : ''}`}>
                            favorite
                          </span>
                        </button>

                        <button 
                          onClick={() => {
                            if (!isLoggedIn && onRequireSignIn) {
                              onRequireSignIn();
                              return;
                            }
                            if (onAddToPlaylist) onAddToPlaylist(track);
                          }}
                          className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                          title="Add to Playlist"
                        >
                          <span className="text-base material-symbols-outlined">playlist_add</span>
                        </button>

                        <span className="text-xs font-medium text-slate-400">
                          {formatTime(track.duration_seconds)}
                        </span>

                        <button 
                          onClick={() => onPlayTrack(track, artistTracks)}
                          className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md transition-transform group-hover:scale-105 active:scale-95 cursor-pointer"
                          title="Play"
                        >
                          <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Artist Composer Section (Active when logged in as the artist owner) */}
          {effectiveIsOwner && (
            <section className="mt-10 mb-6 bg-[#0a1020]/90 border border-[#15213b] hover:border-blue-500/40 rounded-2xl p-6 shadow-xl transition-all" data-purpose="artist-composer-section">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-700/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-black via-zinc-900 to-zinc-800 border border-slate-700/60 overflow-hidden flex flex-col items-center justify-center shrink-0 shadow-md">
                    {artistImage ? (
                      <img src={artistImage} alt={artistName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] text-amber-500 font-bold uppercase">{artistName?.[0]}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white tracking-tight">Studio Broadcast</h3>
                      <span className="text-[10px] font-semibold text-blue-400 bg-blue-600/10 border border-blue-600/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                        Artist Mode Active
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">Post announcements, gear breakdowns, and tour news to your fans</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 space-y-3">
                <textarea 
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  className="w-full bg-[#060a14] border border-[#14223f] focus:border-blue-500 rounded-xl p-3.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none transition-colors resize-none leading-relaxed" 
                  placeholder="Share news from the studio, upcoming releases, tour announcements, or gear insights..." 
                  rows="3"
                ></textarea>

                {/* Hashtag Input Section */}
                <div className="flex items-center gap-2 bg-[#060a14] border border-[#14223f] focus-within:border-blue-500 rounded-xl px-3.5 py-2.5 transition-colors">
                  <span className="text-xs font-semibold text-slate-400 shrink-0">Hashtags:</span>
                  <input
                    type="text"
                    value={customTags}
                    onChange={(e) => setCustomTags(e.target.value)}
                    placeholder="e.g. #NewRelease #StudioLife #Tour2026 (leave blank for automatic tags)"
                    className="w-full bg-transparent text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400 mr-1 shrink-0">Category:</span>
                <button 
                  type="button"
                  onClick={() => handleCategorySelect("Studio Update", "text-blue-400 bg-blue-600/10 border-blue-600/20")}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors leading-none cursor-pointer ${
                    selectedCategory === "Studio Update" 
                      ? 'text-blue-400 bg-blue-600/10 border border-blue-600/30' 
                      : 'text-slate-400 hover:text-white bg-[#0c1629] hover:bg-[#12213d] border border-[#1a2d54]'
                  }`}
                >
                  {selectedCategory === "Studio Update" && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>}
                  <span>Studio Update</span>
                </button>

                <button 
                  type="button"
                  onClick={() => handleCategorySelect("Behind The Scenes", "text-amber-500 bg-amber-500/10 border-amber-500/20")}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors leading-none cursor-pointer ${
                    selectedCategory === "Behind The Scenes" 
                      ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30' 
                      : 'text-slate-400 hover:text-white bg-[#0c1629] hover:bg-[#12213d] border border-[#1a2d54]'
                  }`}
                >
                  {selectedCategory === "Behind The Scenes" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>}
                  <span>Behind The Scenes</span>
                </button>

                <button 
                  type="button"
                  onClick={() => handleCategorySelect("Live Tour", "text-emerald-400 bg-emerald-400/10 border-emerald-400/20")}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors leading-none cursor-pointer ${
                    selectedCategory === "Live Tour" 
                      ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/30' 
                      : 'text-slate-400 hover:text-white bg-[#0c1629] hover:bg-[#12213d] border border-[#1a2d54]'
                  }`}
                >
                  {selectedCategory === "Live Tour" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>}
                  <span>Live Tour</span>
                </button>

                <button 
                  type="button"
                  onClick={() => handleCategorySelect("New Single / Release", "text-blue-400 bg-blue-600/10 border-blue-600/20")}
                  className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors leading-none cursor-pointer ${
                    selectedCategory === "New Single / Release" 
                      ? 'text-blue-400 bg-blue-600/10 border border-blue-600/30' 
                      : 'text-slate-400 hover:text-white bg-[#0c1629] hover:bg-[#12213d] border border-[#1a2d54]'
                  }`}
                >
                  {selectedCategory === "New Single / Release" && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>}
                  <span>New Single / Release</span>
                </button>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-700/40 flex items-center justify-between gap-3">
                <div className="flex items-center">
                  {draftSavedToast && (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 animate-in fade-in">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Draft saved locally!
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={handleSaveDraft}
                    className="inline-flex items-center justify-center whitespace-nowrap text-xs font-medium text-slate-400 hover:text-white px-3 py-2 transition-colors cursor-pointer" 
                  >
                    Save Draft
                  </button>
                  <button 
                    type="button"
                    onClick={handlePublishPost}
                    disabled={!postText.trim()}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer leading-none" 
                  >
                    <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                    </svg>
                    <span>Publish Update</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Artist Posts Section */}
          <section className="mt-10 mb-8" data-purpose="artist-posts-section">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Latest Updates</h2>
                <span className="text-xs text-blue-400 bg-blue-600/10 border border-blue-600/20 px-2.5 py-0.5 rounded-full font-medium">Feed</span>
              </div>
              <span className="text-xs text-slate-400">Direct from {artistName}</span>
            </div>

            {displayedPosts.length === 0 ? (
              <div className="bg-[#0a1020]/50 border border-[#15213b] rounded-2xl p-8 text-center">
                <p className="text-slate-400 text-xs">No updates posted yet.</p>
                {effectiveIsOwner && (
                  <p className="text-blue-400 text-xs mt-1">Use the Studio Broadcast composer above to publish your first update!</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {displayedPosts.map((post) => {
                  const postId = post.id || post._id;
                  const postCategory = post.tag || post.category || 'Studio Update';
                  const postTime = post.time || (post.createdAt || post.created_at ? new Date(post.createdAt || post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently');
                  const postBadgeColor = post.tagColor || (
                    postCategory === 'Behind The Scenes' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' : 
                    postCategory === 'Live Tour' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 
                    'text-blue-400 bg-blue-600/10 border-blue-600/20'
                  );
                  const postTags = post.tags || `#${artistName ? artistName.replace(/\s+/g, '') : 'Artist'} #${postCategory.replace(/\s+/g, '')}`;

                  return (
                    <article 
                      key={postId || Math.random()}
                      className="bg-[#0a1020]/90 border border-[#15213b] hover:border-blue-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all shadow-lg hover:shadow-blue-600/10 group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-700/60 flex items-center justify-center shrink-0 bg-black">
                              {artistImage ? (
                                <img src={artistImage} alt={artistName} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[9px] text-amber-500 font-bold uppercase">{artistName?.[0]}</span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-bold text-white leading-none">{artistName}</h4>
                                <svg className="w-3.5 h-3.5 fill-blue-500 text-black" viewBox="0 0 24 24">
                                  <path clipRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307a4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397a4.491 4.491 0 01-1.307 3.497a4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306a4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497a4.491 4.491 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" fillRule="evenodd"></path>
                                </svg>
                              </div>
                              <span className="text-[10px] text-slate-400">{postTime}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${postBadgeColor}`}>
                              {postCategory}
                            </span>
                            {effectiveIsOwner && (
                              <button
                                type="button"
                                onClick={() => handleDeletePost(postId)}
                                className="text-slate-400 hover:text-red-400 p-1 rounded-md transition-colors cursor-pointer"
                                title="Delete post"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed mb-3 whitespace-pre-wrap">
                          {post.text}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-[11px] text-slate-400">
                        <span className="text-blue-400/80 font-medium">{postTags}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </>
  );
}