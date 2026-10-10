import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import SignIn from './SignIn';
import SignUp from './SignUp';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import DiscoverPage from './DiscoverPage';
import ArtistsPage from './ArtistsPage';
import ArtistHub from './ArtistHub';
import LibraryPage from './LibraryPage';
import NowPlaying from './NowPlaying';
import NowPlayingMobile from '../components/layout/NowPlayingMobile';

export default function HomePage() {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'signin' | 'signup'
  const [currentTab, setCurrentTab] = useState('home'); // 'home' | 'discover' | 'artists' | 'library' | 'artisthub' | 'search' | 'nowplaying'
  const [previousTab, setPreviousTab] = useState('home');
  const [selectedArtistName, setSelectedArtistName] = useState(null);
  const [autoOpenArtistChat, setAutoOpenArtistChat] = useState(false);
  const [chatListenerEmail, setChatListenerEmail] = useState(null);
  
  // Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ tracks: [], artists: [] });
  const [isSearching, setIsSearching] = useState(false);

  // Auth States persisted via localStorage
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });
  const [currentUserEmail, setCurrentUserEmail] = useState(() => {
    return localStorage.getItem('currentUserEmail') || '';
  });
  const [currentUserName, setCurrentUserName] = useState(() => {
    return localStorage.getItem('currentUserName') || '';
  });
  const [currentUserImage, setCurrentUserImage] = useState(() => {
    return localStorage.getItem('currentUserImage') || '';
  });

  // Favourites & Playlist States
  const [likedTrackIds, setLikedTrackIds] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activePlaylistTrack, setActivePlaylistTrack] = useState(null);

  // Followed Artists State synced with MongoDB backend
  const [followedArtistNames, setFollowedArtistNames] = useState([]);

  useEffect(() => {
    document.title = "Sway — Music Platform";
  }, []);

  useEffect(() => {
    if (isLoggedIn && currentUserEmail) {
      fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(currentUserEmail)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.email) {
            const resolvedName = data.name || data.artist_name || '';
            const resolvedImage = data.image || data.profile_pic || '';
            if (resolvedName) {
              setCurrentUserName(resolvedName);
              localStorage.setItem('currentUserName', resolvedName);
            }
            if (resolvedImage) {
              setCurrentUserImage(resolvedImage);
              localStorage.setItem('currentUserImage', resolvedImage);
            }
          }
        })
        .catch(err => console.warn("Could not sync user profile:", err));

      fetch(`${API_BASE_URL}/api/follows/${currentUserEmail}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setFollowedArtistNames(data);
          }
        })
        .catch(err => console.error("Error fetching followed artists:", err));
    } else {
      setFollowedArtistNames([]);
    }
  }, [isLoggedIn, currentUserEmail]);

  const handleToggleFollowArtist = async (artistName) => {
    if (!isLoggedIn) {
      setCurrentView('signin');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/follows/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: currentUserEmail,
          artist_name: artistName
        })
      });
      const data = await response.json();
      if (data.followed_artists) {
        setFollowedArtistNames(data.followed_artists);
      }
    } catch (err) {
      console.error("Failed to toggle follow artist:", err);
    }
  };

  // Dynamic Backend Track & Artist States
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Playback Queue States
  const [playbackQueue, setPlaybackQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);

  // Audio Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [volume, setVolume] = useState(1);

  // Mobile full-screen Now Playing overlay
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);

  const audioRef = useRef(null);

  // Seek to a specific time in the current track
  const handleSeek = (newTime) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const tracksRes = await fetch(`${API_BASE_URL}/api/tracks`);
        if (tracksRes.ok) {
          const data = await tracksRes.json();
          const trackList = Array.isArray(data) ? data : (data.tracks || data.data || []);
          if (trackList.length > 0) {
            const formattedTracks = trackList.map((raw, index) => ({
              _id: raw._id || raw.id || index.toString(),
              title: raw.title || "Untitled Track",
              artist_name: raw.artist_name || raw.artist || "Unknown Artist",
              audio_url: raw.audio_url || raw.url || raw.file_url || "",
              cover_art_url: raw.cover_art_url || raw.cover_image || raw.image_url || "https://via.placeholder.com/300",
              duration_seconds: raw.duration_seconds || raw.duration || 0,
              genre: raw.genre || raw.genre_name || "General",
              album_name: raw.album_name || raw.album || "Single"
            }));
            const shuffled = shuffleArray(formattedTracks);
            setTracks(shuffled);
            if (playbackQueue.length === 0) {
              setPlaybackQueue(shuffled);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching tracks from backend:", err);
      }

      try {
        const artistsRes = await fetch(`${API_BASE_URL}/api/artists`);
        if (artistsRes.ok) {
          const artistsData = await artistsRes.json();
          const parsedArtists = Array.isArray(artistsData) ? artistsData : (artistsData.artists || artistsData.data || []);
          setArtists(shuffleArray(parsedArtists));
        }
      } catch (artistErr) {
        console.warn('Could not load artists from backend:', artistErr);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  useEffect(() => {
    if (isLoggedIn && currentUserEmail) {
      fetch(`${API_BASE_URL}/api/playlists/${currentUserEmail}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPlaylists(data);
          }
        })
        .catch(err => console.error("Error fetching user playlists:", err));
    } else {
      setPlaylists([]);
    }
  }, [isLoggedIn, currentUserEmail]);

  useEffect(() => {
    if (isLoggedIn && currentUserEmail) {
      fetch(`${API_BASE_URL}/api/favorites/${currentUserEmail}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setLikedTrackIds(data);
          }
        })
        .catch(err => console.error("Error fetching user favorites:", err));
    } else {
      setLikedTrackIds([]);
    }
  }, [isLoggedIn, currentUserEmail]);

  useEffect(() => {
    if (isLoggedIn && currentUserEmail) {
      fetch(`${API_BASE_URL}/api/users/${currentUserEmail}`)
        .then(res => res.json())
        .then(async data => {
          let name = data?.name || '';
          let image = data?.image || data?.profile_pic || data?.image_url || '';

          if (!image) {
            try {
              const artistRes = await fetch(`${API_BASE_URL}/api/artists`);
              if (artistRes.ok) {
                const artistsList = await artistRes.json();
                const matchedArtist = (Array.isArray(artistsList) ? artistsList : []).find(
                  a => a.email === currentUserEmail || a.name === name
                );
                if (matchedArtist) {
                  image = matchedArtist.image || matchedArtist.image_url || matchedArtist.profile_image || '';
                }
              }
            } catch (e) {
              console.warn("Could not fetch artist fallback image:", e);
            }
          }

          setCurrentUserName(name);
          setCurrentUserImage(image);
          localStorage.setItem('currentUserName', name);
          localStorage.setItem('currentUserImage', image);
        })
        .catch(err => console.error("Error fetching user profile:", err));
    } else {
      setCurrentUserName('');
      setCurrentUserImage('');
    }
  }, [isLoggedIn, currentUserEmail]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults({ tracks: [], artists: [] });
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(() => {
      fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(trimmed)}`)
        .then(res => res.json())
        .then(data => {
          setSearchResults({
            tracks: Array.isArray(data.tracks) ? data.tracks : [],
            artists: Array.isArray(data.artists) ? data.artists : []
          });
          setIsSearching(false);
        })
        .catch(err => {
          console.error("Error fetching global search:", err);
          setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const currentTrack = playbackQueue[currentQueueIndex] || tracks[0] || {
    title: "Glass Meridian",
    artist_name: "Prism Audio",
    audio_url: "",
    cover_art_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDO4pZi9_k0EKeZdCDZ931hbNhjLlmSiN_IHwZ3lG1o99Pfybmkeprx4vdpsxAuiTMZyMLkrVndJxNab0hdDG_PR4u2qMYVdroJS-q3Zlj6qu5eSa6vspjRSqIe2zJ7FqF0ECz-13Rxwi8olVfipKJoTnkYI1nzSG-vG6x6aNcbqtMBQ1oZUOnOsx9Ct6JEpXa3g23WokL6mtCYrV79tDzo3SuwsFdoBocu_DjEw8EVCkgpPpg2R2pootL5ElQEHiJI1hr2CdsG9gE",
    duration_seconds: 248
  };

  const playQueueIndex = (index) => {
    setCurrentQueueIndex(index);
    setTimeout(() => {
      if (audioRef.current && playbackQueue[index]?.audio_url) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(err => console.error("Audio playback execution failed:", err));
      }
    }, 100);
  };

  const playPlaylist = (playlistInput, startIndex = 0) => {
    let targetTracks = [];

    if (playlistInput && (playlistInput.id === 'favorites' || playlistInput.name === 'Favourite Songs')) {
      targetTracks = likedTrackIds.map(id => tracks.find(t => t._id === id)).filter(Boolean);
    } else if (Array.isArray(playlistInput)) {
      if (playlistInput.length > 0 && typeof playlistInput[0] === 'string') {
        targetTracks = playlistInput.map(id => tracks.find(t => t._id === id)).filter(Boolean);
      } else {
        targetTracks = playlistInput;
      }
    } else if (playlistInput) {
      if (playlistInput.tracks && Array.isArray(playlistInput.tracks)) {
        targetTracks = playlistInput.tracks;
      } else if (playlistInput.trackIds && Array.isArray(playlistInput.trackIds)) {
        targetTracks = playlistInput.trackIds.map(id => tracks.find(t => t._id === id)).filter(Boolean);
      }
    }

    if (!targetTracks || targetTracks.length === 0) return;

    // Shuffle the tracks every time the playlist is clicked[cite: 7]
    const shuffledTracks = shuffleArray(targetTracks);
    setPlaybackQueue(shuffledTracks);
    playQueueIndex(0);
  };

  const playTrackObject = (trackObj, customQueue = null) => {
    let targetQueue = customQueue && customQueue.length > 0 ? customQueue : null;

    if (!targetQueue) {
      const sameGenreTracks = tracks.filter(t => t.genre === trackObj.genre && t._id !== trackObj._id);
      targetQueue = sameGenreTracks.length > 0 
        ? [trackObj, ...sameGenreTracks]
        : [trackObj, ...tracks.filter(t => t._id !== trackObj._id)];
    }

    const foundIndex = targetQueue.findIndex(t => t._id === trackObj._id);
    
    if (foundIndex !== -1) {
      setPlaybackQueue(targetQueue);
      playQueueIndex(foundIndex);
    } else {
      const newQueue = [trackObj, ...targetQueue];
      setPlaybackQueue(newQueue);
      playQueueIndex(0);
    }
  };

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    const targetTrack = activePlaylistTrack || currentTrack;

    try {
      const response = await fetch(`${API_BASE_URL}/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newPlaylistName.trim(), 
          trackIds: [targetTrack._id],
          user_email: currentUserEmail 
        })
      });
      const savedPlaylist = await response.json();

      setPlaylists(prev => [...prev, savedPlaylist]);
      setNewPlaylistName('');
      setIsPlaylistModalOpen(false);
      setActivePlaylistTrack(null);
    } catch (err) {
      console.error("Failed to create playlist:", err);
    }
  };

  const handleLibraryCreatePlaylist = async (name) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name, 
          trackIds: [],
          user_email: currentUserEmail 
        })
      });
      const savedPlaylist = await response.json();
      setPlaylists(prev => [...prev, savedPlaylist]);
    } catch (err) {
      console.error("Failed to create library playlist:", err);
    }
  };

  const handleAddToExistingPlaylist = async (playlistId) => {
    const targetTrack = activePlaylistTrack || currentTrack;

    try {
      await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: targetTrack._id })
      });

      setPlaylists(prev => prev.map(p => {
        if (p.id === playlistId) {
          if (p.trackIds.includes(targetTrack._id)) return p;
          return { ...p, trackIds: [...p.trackIds, targetTrack._id] };
        }
        return p;
      }));
      setIsPlaylistModalOpen(false);
      setActivePlaylistTrack(null);
    } catch (err) {
      console.error("Failed to add track to playlist:", err);
    }
  };

  const handleDeletePlaylist = async (playlistId) => {
    if (playlistId === 'favorites') return;
    try {
      await fetch(`${API_BASE_URL}/api/playlists/${playlistId}`, {
        method: 'DELETE'
      });
      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    } catch (err) {
      console.error("Failed to delete playlist:", err);
    }
  };

  const handleRemoveTrackFromPlaylist = async (playlistId, trackId) => {
    try {
      await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE'
      });

      setPlaylists(prev => prev.map(p => {
        if (p.id === playlistId) {
          return { ...p, trackIds: p.trackIds.filter(id => id !== trackId) };
        }
        return p;
      }));
    } catch (err) {
      console.error("Failed to remove track from playlist:", err);
    }
  };

  const togglePlay = () => {
    if (!currentTrack.audio_url) {
      console.warn("Playback blocked: No audio URL found on track object!", currentTrack);
      return;
    }
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error("Browser audio play execution failed:", err));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || currentTrack.duration_seconds || 0);
    }
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleNextTrack = () => {
    if (playbackQueue.length === 0) return;

    if (isRepeat) {
      playQueueIndex(currentQueueIndex);
      return;
    }

    if (isShuffle) {
      let randomIndex = currentQueueIndex;
      if (playbackQueue.length > 1) {
        do {
          randomIndex = Math.floor(Math.random() * playbackQueue.length);
        } while (randomIndex === currentQueueIndex);
      }
      playQueueIndex(randomIndex);
    } else {
      const nextIndex = currentQueueIndex + 1;
      if (nextIndex < playbackQueue.length) {
        playQueueIndex(nextIndex);
      } else {
        playQueueIndex(0);
      }
    }
  };

  const handlePrevTrack = () => {
    if (playbackQueue.length === 0) return;
    const prevIndex = (currentQueueIndex - 1 + playbackQueue.length) % playbackQueue.length;
    playQueueIndex(prevIndex);
  };

  const handleToggleLikeForTrack = async (trackId) => {
    if (!isLoggedIn) {
      setCurrentView('signin');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/favorites/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: currentUserEmail,
          trackId: trackId
        })
      });
      const data = await response.json();
      if (data.trackIds) {
        setLikedTrackIds(data.trackIds);
      }
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };

  const handleToggleLike = () => {
    handleToggleLikeForTrack(currentTrack._id);
  };

  const handleSignInSuccess = (userDataOrEmail, maybeName, maybeImage) => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');

    if (typeof userDataOrEmail === 'object' && userDataOrEmail !== null) {
      const email = (userDataOrEmail.email || '').trim().toLowerCase();
      const name = userDataOrEmail.name || userDataOrEmail.artist_name || '';
      const image = userDataOrEmail.image || userDataOrEmail.profile_pic || '';
      
      setCurrentUserEmail(email);
      localStorage.setItem('currentUserEmail', email);

      if (name) {
        setCurrentUserName(name);
        localStorage.setItem('currentUserName', name);
      }
      if (image) {
        setCurrentUserImage(image);
        localStorage.setItem('currentUserImage', image);
      }
    } else {
      const email = (userDataOrEmail || '').trim().toLowerCase();
      setCurrentUserEmail(email);
      localStorage.setItem('currentUserEmail', email);

      if (maybeName) {
        setCurrentUserName(maybeName);
        localStorage.setItem('currentUserName', maybeName);
      }
      if (maybeImage) {
        setCurrentUserImage(maybeImage);
        localStorage.setItem('currentUserImage', maybeImage);
      }
    }

    setCurrentView('home');
  };

  const handleSignOut = () => {
    setIsLoggedIn(false);
    setCurrentUserEmail('');
    setCurrentUserName('');
    setCurrentUserImage('');
    setLikedTrackIds([]);
    setFollowedArtistNames([]); 
    
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUserEmail');
    localStorage.removeItem('currentUserName');
    localStorage.removeItem('currentUserImage');

    window.location.reload(); 
  };

  if (currentView === 'signup') {
    return (
      <SignUp 
        onSignUpSuccess={() => setCurrentView('signin')}
        onSwitchToSignIn={() => setCurrentView('signin')}
        onBackToHome={() => setCurrentView('home')}
      />
    );
  }

  if (currentView === 'signin') {
    return (
      <SignIn 
        onSignInSuccess={handleSignInSuccess}
        onSwitchToSignUp={() => setCurrentView('signup')}
        onBackToHome={() => setCurrentView('home')}
      />
    );
  }

  const modalTargetTrack = activePlaylistTrack || currentTrack;
  const sidebarPlaylists = isLoggedIn 
    ? [{ id: 'favorites', name: 'Favourite Songs', trackIds: likedTrackIds }, ...playlists]
    : playlists;

  return (
    <div className="bg-[#08101a] text-[#e1e2ed] font-sans selection:bg-[#2563eb]/30 min-h-screen overflow-x-hidden antialiased">
      {currentTrack.audio_url && (
        <audio 
          ref={audioRef} 
          src={currentTrack.audio_url} 
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleNextTrack}
          onError={(e) => console.error("HTML5 Audio Engine Error:", e.target.error)}
        />
      )}

      <Sidebar 
        activeTab={currentTab} 
        onNavigate={setCurrentTab} 
        playlists={sidebarPlaylists} 
        onPlayPlaylist={playPlaylist}
      />

      <Header 
        isLoggedIn={isLoggedIn}
        currentUserEmail={currentUserEmail}
        currentUserName={currentUserName}
        currentUserImage={currentUserImage}
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          if (val.trim() && currentTab !== 'search') {
            setCurrentTab('search');
          } else if (!val.trim() && currentTab === 'search') {
            setCurrentTab('home');
          }
        }}
        onSignOut={handleSignOut}
        onNavigateToSignIn={() => setCurrentView('signin')}
        onNavigateToSignUp={() => setCurrentView('signup')}
        onSelectArtist={(artistName, shouldOpenChatOrListener = false, specificListener = null) => {
          setSelectedArtistName(artistName);
          if (typeof shouldOpenChatOrListener === 'string' && shouldOpenChatOrListener.includes('@')) {
            setAutoOpenArtistChat(true);
            setChatListenerEmail(shouldOpenChatOrListener);
          } else {
            setAutoOpenArtistChat(Boolean(shouldOpenChatOrListener));
            setChatListenerEmail(specificListener || null);
          }
          setCurrentTab('artisthub');
        }}
      />

      <main className="md:ml-64 relative pt-16 md:pt-20 pb-36 md:pb-28 min-h-screen">
        {currentTab === 'nowplaying' && (
          <div className="max-w-7xl mx-auto px-4">
            <NowPlaying 
              currentTrack={currentTrack}
              tracks={playbackQueue.length > 0 ? playbackQueue : tracks}
              currentTrackIndex={currentQueueIndex}
              onPlayTrack={(trackObj) => playTrackObject(trackObj, playbackQueue)}
              onClose={() => setCurrentTab(previousTab)}
              isLoggedIn={isLoggedIn}
              likedTrackIds={likedTrackIds}
              onToggleLike={handleToggleLikeForTrack}
              onAddToPlaylist={(track) => {
                setActivePlaylistTrack(track);
                setIsPlaylistModalOpen(true);
              }}
              onSelectArtist={(artistName) => {
                setSelectedArtistName(artistName);
                setCurrentTab('artisthub');
              }}
            />
          </div>
        )}

        {currentTab === 'home' && (
          <div className="px-4 sm:px-6 md:px-8 max-w-7xl mx-auto space-y-8 md:space-y-12">
            {/* Hero Banner Section */}
            <section className="relative rounded-2xl md:rounded-[40px] overflow-hidden min-h-[380px] md:min-h-[500px] flex items-center group">
              <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-r from-[#08101a] via-[#08101a]/40 to-transparent z-10"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#08101a] to-transparent z-10"></div>
                <img 
                  className="w-full h-full object-cover opacity-60" 
                  alt="Hero Background" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBsgrEuXKzdQof0a1nQh1cT5kviBDKnalRny6ejDySvSDnfv76TCWIzh23YJkJ9zXBPtw_gs-Y3Ql8WKvOmlOzDgqkufL3e-wM7IaZ5e4uCip3c4B6Xh1molo0fGO4xHNaPytT8sM8vojsdbPuNXX6OH2_d6gorz6BFOk_Y9_fsuS-CN__-icCYTQwagUjpHx7KX3RpFovVeAStcw30kfRlB-3o4Uu0eQsuCHC6lMMXMwtlqVrqhkBJ_0nWaUFjpBU9MBcwHps7iwM" 
                />
              </div>

              <div className="relative z-20 w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center p-6 sm:p-8 lg:px-12">
                <div className="space-y-4 md:space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/10 text-[10px] font-bold tracking-[0.2em] text-[#e1e2ed] uppercase">
                    <span className="w-2 h-2 rounded-full bg-[#2563eb] shadow-[0_0_8px_rgba(37,99,235,0.8)]"></span>
                    Sway Featured Playlist
                  </div>
                  <h2 className="font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-[0.9] tracking-tight">
                    Late Night<br />Frequencies
                  </h2>
                  <div className="space-y-1 md:space-y-2">
                    <p className="text-[#e1e2ed] font-semibold text-base md:text-lg">Featured Songs</p>
                    <p className="text-[#c3c6d7] text-xs md:text-sm tracking-wider font-mono">{tracks.length} tracks loaded dynamically</p>
                  </div>
                  <div className="flex gap-4 pt-2 md:pt-4">
                    <button 
                      onClick={() => {
                        if (tracks.length > 0) playPlaylist(tracks, 0);
                      }}
                      className="bg-[#2563eb] text-white px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-sm md:text-base flex items-center gap-2 hover:scale-105 transition-transform cursor-pointer shadow-lg shadow-[#2563eb]/30"
                    >
                      <span className="material-symbols-outlined fill-1" data-icon="play_arrow">play_arrow</span>
                      Play Playlist
                    </button>
                  </div>
                </div>

                <div className="hidden lg:block space-y-3">
                  {loading ? (
                    <p className="text-[#c3c6d7] text-sm">Loading dynamic tracks...</p>
                  ) : tracks.length === 0 ? (
                    <p className="text-[#c3c6d7] text-sm">No backend tracks found.</p>
                  ) : (
                    tracks.slice(0, 3).map((track, idx) => (
                      <div 
                        key={track._id}
                        onClick={() => playTrackObject(track, null)}
                        className="bg-[#0d1825]/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/[0.05] transition-colors cursor-pointer group"
                      >
                        <span className="text-[#c3c6d7] font-mono text-xs w-4">{idx + 1}</span>
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#0d1825] flex-shrink-0">
                          <img className="w-full h-full object-cover" alt={track.title} src={track.cover_art_url} />
                        </div>
                        <div className="flex-1 truncate">
                          <h4 className="text-white font-bold text-sm truncate">{track.title}</h4>
                          <p 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (track.artist_name) {
                                setSelectedArtistName(track.artist_name);
                                setCurrentTab('artisthub');
                              }
                            }}
                            className="text-[#c3c6d7] text-xs truncate hover:text-white hover:underline transition-colors w-fit cursor-pointer"
                          >
                            {track.artist_name}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleToggleLikeForTrack(track._id)}
                            className="text-[#c3c6d7] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title={isLoggedIn ? (likedTrackIds.includes(track._id) ? "Remove from Favourites" : "Add to Favourites") : "Sign in to favourite"}
                          >
                            <span className={`material-symbols-outlined text-lg ${likedTrackIds.includes(track._id) ? 'fill-1 text-red-500' : ''}`}>
                              favorite
                            </span>
                          </button>
                          <button 
                            onClick={() => {
                              if (!isLoggedIn) {
                                setCurrentView('signin');
                                return;
                              }
                              setActivePlaylistTrack(track);
                              setIsPlaylistModalOpen(true);
                            }}
                            className="text-[#c3c6d7] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Add to Playlist"
                          >
                            <span className="material-symbols-outlined text-lg">playlist_add</span>
                          </button>
                        </div>

                        <span className="text-[#c3c6d7] text-xs font-mono w-10 text-right">{formatTime(track.duration_seconds)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Featured Artists Section (shown before Featured Songs) */}
            <section className="mt-8 md:mt-12">
              <div className="flex justify-between items-end mb-4 md:mb-6">
                <h3 className="font-bold text-xl text-[#e1e2ed]">Featured Artists</h3>
                <button 
                  onClick={() => setCurrentTab('artists')}
                  className="flex items-center gap-1 text-xs font-bold text-[#3b82f6] hover:text-blue-400 transition-colors uppercase tracking-wider cursor-pointer"
                >
                  <span>SEE ALL</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>
              {artists.length === 0 ? (
                <p className="text-[#c3c6d7] text-sm">Loading artists...</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                  {artists.slice(0, 5).map((artist) => {
                    const artistName = artist.name || artist.artist_name || artist.artist;
                    return (
                      <div 
                        key={artist._id || artist.id}
                        onClick={() => {
                          setSelectedArtistName(artistName);
                          setCurrentTab('artisthub');
                        }}
                        className="bg-[#0d1825]/40 border border-[#8d90a0]/10 p-4 rounded-2xl hover:border-[#2563eb]/50 transition-all group cursor-pointer text-center space-y-3"
                      >
                        <div className="aspect-square rounded-full overflow-hidden mx-auto bg-[#08101a] w-24 h-24 sm:w-28 sm:h-28 shadow-lg">
                          <img 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                            alt={artistName} 
                            src={artist.image || artist.image_url || artist.profile_image || artist.avatar || artist.photo_url || artist.imageUrl || artist.cover_art_url || "https://via.placeholder.com/300"} 
                          />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-[#e1e2ed] truncate">{artistName}</h4>
                          <p className="text-[#c3c6d7] text-xs mt-0.5 truncate">{artist.genre || "Artist"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Featured Songs Grid Section (Shows all songs, no see all button) */}
            <section className="mt-8 md:mt-12">
              <div className="flex justify-between items-end mb-4 md:mb-6">
                <h3 className="font-bold text-xl text-[#e1e2ed]">Featured Songs</h3>
              </div>
              {loading ? (
                <p className="text-[#c3c6d7] text-sm">Loading tracks...</p>
              ) : tracks.length === 0 ? (
                <p className="text-[#c3c6d7] text-sm">No tracks available.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                  {tracks.map((track) => (
                    <div 
                      key={track._id}
                      onClick={() => playTrackObject(track, null)}
                      className={`bg-[#0d1825]/40 border ${currentTrack._id === track._id ? 'border-[#2563eb]' : 'border-[#8d90a0]/10'} p-3 sm:p-4 rounded-2xl hover:border-[#2563eb]/50 transition-all group cursor-pointer flex flex-col justify-between`}
                    >
                      <div>
                        <div className="aspect-square rounded-xl overflow-hidden mb-3 relative bg-[#08101a]">
                          <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={track.title} src={track.cover_art_url} />
                          <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${isPlaying && currentTrack._id === track._id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <button className="w-10 h-10 sm:w-12 sm:h-12 bg-[#2563eb] rounded-full flex items-center justify-center text-white shadow-xl cursor-pointer">
                              <span className="material-symbols-outlined fill-1" data-icon="play_arrow">
                                {isPlaying && currentTrack._id === track._id ? 'pause' : 'play_arrow'}
                              </span>
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-sm text-[#e1e2ed] truncate">{track.title}</h4>
                        <p 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (track.artist_name) {
                              setSelectedArtistName(track.artist_name);
                              setCurrentTab('artisthub');
                            }
                          }}
                          className="text-[#c3c6d7] text-xs mt-1 truncate hover:text-white hover:underline transition-colors w-fit cursor-pointer"
                        >
                          {track.artist_name}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[10px] font-mono text-[#c3c6d7]">{formatTime(track.duration_seconds)}</span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleToggleLikeForTrack(track._id)}
                            className="text-[#c3c6d7] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                            title={isLoggedIn ? (likedTrackIds.includes(track._id) ? "Remove from Favourites" : "Add to Favourites") : "Sign in to favourite"}
                          >
                            <span className={`material-symbols-outlined text-lg ${likedTrackIds.includes(track._id) ? 'fill-1 text-red-500' : ''}`}>
                              favorite
                            </span>
                          </button>
                          <button 
                            onClick={() => {
                              if (!isLoggedIn) {
                                setCurrentView('signin');
                                return;
                              }
                              setActivePlaylistTrack(track);
                              setIsPlaylistModalOpen(true);
                            }}
                            className="text-[#c3c6d7] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                            title="Add to Playlist"
                          >
                            <span className="material-symbols-outlined text-lg">playlist_add</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Search Results View Tab */}
        {currentTab === 'search' && (
          <div className="px-8 max-w-7xl mx-auto space-y-10">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-black text-white">Search Results</h2>
              <p className="text-sm text-[#c3c6d7]">Showing matches for &quot;<span className="text-white font-semibold">{searchQuery}</span>&quot;</p>
            </div>

            {isSearching ? (
              <div className="bg-[#0d1825]/40 border border-white/5 rounded-2xl p-12 text-center space-y-3">
                <p className="text-sm text-[#c3c6d7]">Searching database...</p>
              </div>
            ) : (
              <>
                {searchResults.artists.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold text-[#e1e2ed]">Artists</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {searchResults.artists.map((artist) => {
                        const artistName = artist.name || artist.artist_name;
                        return (
                          <div 
                            key={artist.id || artist._id}
                            onClick={() => {
                              setSelectedArtistName(artistName);
                              setCurrentTab('artisthub');
                            }}
                            className="bg-[#0d1825]/40 border border-[#8d90a0]/10 p-4 rounded-2xl hover:border-[#2563eb]/50 transition-all group cursor-pointer text-center space-y-3"
                          >
                            <div className="aspect-square rounded-full overflow-hidden mx-auto bg-[#08101a] w-28 h-28 shadow-lg">
                              <img 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                alt={artistName} 
                                src={artist.image || artist.image_url || "https://via.placeholder.com/300"} 
                              />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-[#e1e2ed] truncate">{artistName}</h4>
                              <p className="text-[#c3c6d7] text-xs mt-0.5">{artist.genre || "Artist"}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-[#e1e2ed]">Songs</h3>
                  {searchResults.tracks.length === 0 && searchResults.artists.length === 0 ? (
                    <div className="bg-[#0d1825]/40 border border-white/5 rounded-2xl p-12 text-center space-y-3">
                      <span className="material-symbols-outlined text-4xl text-[#c3c6d7]">search_off</span>
                      <p className="text-base font-semibold text-white">No results found matching &quot;{searchQuery}&quot;</p>
                      <p className="text-xs text-[#c3c6d7]">Check your spelling or search for another song or artist.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.tracks.map((track) => (
                        <div 
                          key={track._id}
                          onClick={() => playTrackObject(track, searchResults.tracks)}
                          className="bg-[#0d1825]/60 border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/[0.05] transition-colors cursor-pointer group"
                        >
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#0d1825] flex-shrink-0">
                            <img className="w-full h-full object-cover" alt={track.title} src={track.cover_art_url} />
                          </div>
                          <div className="flex-1 truncate">
                            <h4 className="text-white font-bold text-sm truncate">{track.title}</h4>
                            <p className="text-[#c3c6d7] text-xs truncate">
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (track.artist_name) {
                                    setSelectedArtistName(track.artist_name);
                                    setCurrentTab('artisthub');
                                  }
                                }}
                                className="hover:text-white hover:underline cursor-pointer"
                              >
                                {track.artist_name}
                              </span>
                              {" • " + track.genre}
                            </p>
                          </div>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => handleToggleLikeForTrack(track._id)}
                              className="text-[#c3c6d7] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                              title={isLoggedIn ? (likedTrackIds.includes(track._id) ? "Remove from Favourites" : "Add to Favourites") : "Sign in to favourite"}
                            >
                              <span className={`material-symbols-outlined text-lg ${likedTrackIds.includes(track._id) ? 'fill-1 text-red-500' : ''}`}>
                                favorite
                              </span>
                            </button>
                            <button 
                              onClick={() => {
                                if (!isLoggedIn) {
                                  setCurrentView('signin');
                                  return;
                                }
                                setActivePlaylistTrack(track);
                                setIsPlaylistModalOpen(true);
                              }}
                              className="text-[#c3c6d7] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                              title="Add to Playlist"
                            >
                              <span className="material-symbols-outlined text-lg">playlist_add</span>
                            </button>
                          </div>

                          <span className="text-[#c3c6d7] text-xs font-mono w-10 text-right">{formatTime(track.duration_seconds)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {currentTab === 'discover' && (
          <DiscoverPage 
            externalTracks={tracks} 
            onPlayTrack={(track, queue) => playTrackObject(track, queue || tracks)} 
            onSelectArtist={(artistName) => {
              setSelectedArtistName(artistName);
              setCurrentTab('artisthub');
            }}
            isLoggedIn={isLoggedIn}
            likedTrackIds={likedTrackIds}
            onToggleLike={handleToggleLikeForTrack}
            onAddToPlaylist={(track) => {
              setActivePlaylistTrack(track);
              setIsPlaylistModalOpen(true);
            }}
            onRequireSignIn={() => setCurrentView('signin')}
          />
        )}
        
        {currentTab === 'artists' && (
          <ArtistsPage 
            onSelectArtist={(artistName, shouldOpenChat = false, listenerEmail = null) => {
              setSelectedArtistName(artistName);
              setAutoOpenArtistChat(Boolean(shouldOpenChat));
              setChatListenerEmail(listenerEmail || (shouldOpenChat ? (currentUserEmail || localStorage.getItem('currentUserEmail')) : null));
              setCurrentTab('artisthub');
            }} 
          />
        )}
        {currentTab === 'artisthub' && (
          <ArtistHub 
            artistName={selectedArtistName || currentTrack.artist_name} 
            onBack={() => {
              setAutoOpenArtistChat(false);
              setChatListenerEmail(null);
              setCurrentTab('home');
            }} 
            onPlayTrack={(track, queue) => playTrackObject(track, queue || tracks)}
            isLoggedIn={isLoggedIn}
            currentUser={{
              name: currentUserName,
              email: currentUserEmail,
              image: currentUserImage,
            }}
            currentUserName={currentUserName}
            currentUserEmail={currentUserEmail}
            currentUserImage={currentUserImage}
            likedTrackIds={likedTrackIds}
            onToggleLike={handleToggleLikeForTrack}
            onAddToPlaylist={(track) => {
              setActivePlaylistTrack(track);
              setIsPlaylistModalOpen(true);
            }}
            onRequireSignIn={() => setCurrentView('signin')}
            followedArtistNames={followedArtistNames}
            onToggleFollowArtist={handleToggleFollowArtist}
            initialOpenChat={autoOpenArtistChat}
            initialListenerEmail={chatListenerEmail}
            onOpenChat={(targetArtist, targetListener) => {
              if (targetArtist) setSelectedArtistName(targetArtist);
              setAutoOpenArtistChat(true);
              setChatListenerEmail(targetListener || currentUserEmail || localStorage.getItem('currentUserEmail'));
            }}
          />
        )}
        {currentTab === 'library' && (
          <LibraryPage 
            likedTrackIds={likedTrackIds}
            playlists={playlists}
            tracks={tracks}
            artists={artists}
            followedArtistNames={followedArtistNames}
            onSelectArtist={(artistName) => {
              setSelectedArtistName(artistName);
              setCurrentTab('artisthub');
            }}
            onPlayTrack={(track, queue) => {
              const likedTracks = tracks.filter(t => likedTrackIds.includes(t._id));
              const targetQueue = queue || (likedTrackIds.includes(track._id) ? likedTracks : tracks);
              playTrackObject(track, targetQueue);
            }}
            onPlayPlaylist={playPlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onCreatePlaylist={handleLibraryCreatePlaylist}
            onRemoveFromPlaylist={handleRemoveTrackFromPlaylist}
            onToggleLike={handleToggleLikeForTrack}
            isLoggedIn={isLoggedIn}
            onRequireSignIn={() => setCurrentView('signin')}
          />
        )}
      </main>

      {/* Desktop Footer Player Bar */}
      <footer 
        onClick={() => {
          if (currentTab === 'nowplaying') {
            setCurrentTab(previousTab);
          } else {
            setPreviousTab(currentTab);
            setCurrentTab('nowplaying');
          }
        }}
        className="hidden md:flex fixed bottom-0 left-0 w-full z-50 h-20 bg-[#08101a]/90 backdrop-blur-2xl border-t border-white/10 px-8 justify-between items-center cursor-pointer hover:bg-[#08101a]/95 transition-all shadow-2xl"
      >
        <div className="flex items-center gap-4 w-1/4 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
          <div 
            className="flex items-center gap-4 group flex-1 min-w-0"
          >
            <img 
              className="w-12 h-12 rounded-lg object-cover shadow-lg flex-shrink-0 cursor-pointer" 
              alt="Current Track" 
              src={currentTrack.cover_art_url} 
              onClick={() => {
                if (currentTab === 'nowplaying') {
                  setCurrentTab(previousTab);
                } else {
                  setPreviousTab(currentTab);
                  setCurrentTab('nowplaying');
                }
              }}
              title={currentTab === 'nowplaying' ? "Retract Now Playing" : "Open Now Playing"}
            />
            <div className="hidden sm:block overflow-hidden min-w-0">
              <p 
                className="font-bold text-sm text-white truncate group-hover:text-[#2563eb] transition-colors cursor-pointer"
                onClick={() => {
                  if (currentTab === 'nowplaying') {
                    setCurrentTab(previousTab);
                  } else {
                    setPreviousTab(currentTab);
                    setCurrentTab('nowplaying');
                  }
                }}
                title={currentTab === 'nowplaying' ? "Retract Now Playing" : "Open Now Playing"}
              >
                {currentTrack.title}
              </p>
              <p 
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentTrack.artist_name) {
                    setSelectedArtistName(currentTrack.artist_name);
                    setCurrentTab('artisthub');
                  }
                }}
                className="text-[#c3c6d7] text-xs truncate hover:underline cursor-pointer"
                title={`View artist: ${currentTrack.artist_name}`}
              >
                {currentTrack.artist_name}
              </p>
            </div>
          </div>

          <button 
            onClick={handleToggleLike}
            className="text-[#c3c6d7] hover:text-white transition-colors cursor-pointer p-1 flex-shrink-0"
            title={isLoggedIn ? (likedTrackIds.includes(currentTrack._id) ? "Remove from Favourites" : "Add to Favourites") : "Sign in to favourite"}
          >
            <span className={`material-symbols-outlined text-xl ${likedTrackIds.includes(currentTrack._id) ? 'fill-1 text-red-500' : ''}`}>
              favorite
            </span>
          </button>

          <button 
            onClick={() => {
              if (!isLoggedIn) {
                setCurrentView('signin');
                return;
              }
              setActivePlaylistTrack(currentTrack);
              setIsPlaylistModalOpen(true);
            }}
            className="text-[#c3c6d7] hover:text-white transition-colors cursor-pointer p-1 flex-shrink-0"
            title="Add to Playlist"
          >
            <span className="material-symbols-outlined text-xl">playlist_add</span>
          </button>
        </div>

        <div className="flex-1 max-w-xl flex flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsShuffle(!isShuffle)} 
              className={`transition-colors cursor-pointer ${isShuffle ? 'text-blue-500' : 'text-[#c3c6d7] hover:text-white'}`}
              title="Toggle Shuffle"
            >
              <span className="material-symbols-outlined text-lg">shuffle</span>
            </button>

            <button 
              onClick={handlePrevTrack}
              className="text-[#c3c6d7] hover:text-white transition-colors cursor-pointer"
              title="Previous Track"
            >
              <span className="material-symbols-outlined" data-icon="skip_previous">skip_previous</span>
            </button>

            <button 
              className="w-10 h-10 bg-[#2563eb] rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform active:scale-95 shadow-lg shadow-[#2563eb]/20 cursor-pointer" 
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
            >
              <span className="material-symbols-outlined fill-1" data-icon="play_arrow">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button 
              onClick={handleNextTrack}
              className="text-[#c3c6d7] hover:text-white transition-colors cursor-pointer"
              title="Next Track"
            >
              <span className="material-symbols-outlined" data-icon="skip_next">skip_next</span>
            </button>

            <button 
              onClick={() => setIsRepeat(!isRepeat)} 
              className={`transition-colors cursor-pointer ${isRepeat ? 'text-blue-500' : 'text-[#c3c6d7] hover:text-white'}`}
              title="Toggle Repeat"
            >
              <span className="material-symbols-outlined text-lg">repeat</span>
            </button>
          </div>
          
          <div className="w-full flex items-center gap-3 text-xs text-[#c3c6d7] font-mono">
            <span className="w-8 text-right">{formatTime(currentTime)}</span>
            <input 
              type="range" 
              min="0" 
              max={duration || 100} 
              value={currentTime} 
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (audioRef.current) {
                  audioRef.current.currentTime = val;
                }
                setCurrentTime(val);
              }}
              style={{
                background: `linear-gradient(to right, #2563eb ${progressPercent}%, rgba(255, 255, 255, 0.1) ${progressPercent}%)`
              }}
              className="flex-1 h-1 rounded-full appearance-none accent-[#2563eb] cursor-pointer bg-white/10"
            />
            <span className="w-8">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-5 w-1/4 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 w-28 group">
            <span className="material-symbols-outlined text-[#c3c6d7] text-[20px]" data-icon="volume_up">volume_up</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={volume}
              onChange={handleVolumeChange}
              className="w-16 sm:w-20 h-1 bg-white/10 rounded-full appearance-none accent-[#2563eb] cursor-pointer"
            />
          </div>
        </div>
      </footer>

      {/* Playlist Modal */}
      {isPlaylistModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d1825] border border-white/10 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Add to Playlist</h3>
                <p className="text-xs text-[#c3c6d7] truncate max-w-[280px]">Target: {modalTargetTrack.title}</p>
              </div>
              <button onClick={() => { setIsPlaylistModalOpen(false); setActivePlaylistTrack(null); }} className="text-[#c3c6d7] hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <p className="text-xs text-[#c3c6d7] uppercase tracking-wider font-bold">Existing Playlists</p>
              {playlists.length === 0 ? (
                <p className="text-xs text-[#c3c6d7]">No playlists created yet.</p>
              ) : (
                playlists.map(playlist => {
                  const isAlreadyAdded = playlist.trackIds?.includes(modalTargetTrack._id);
                  return (
                    <div key={playlist.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                      <span className="text-sm font-semibold text-white truncate max-w-[180px]">{playlist.name}</span>
                      <button 
                        onClick={() => handleAddToExistingPlaylist(playlist.id)}
                        disabled={isAlreadyAdded}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${isAlreadyAdded ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-[#2563eb] text-white hover:bg-blue-600 cursor-pointer'}`}
                      >
                        {isAlreadyAdded ? 'Added' : 'Add'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-xs text-[#c3c6d7] uppercase tracking-wider font-bold mb-2">Create New Playlist</p>
              <form onSubmit={handleCreatePlaylist} className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Playlist name..."
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className="flex-1 bg-[#08101a] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#2563eb]"
                />
                <button type="submit" className="bg-[#2563eb] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors cursor-pointer">
                  Create
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Mini Player */}
      {currentTrack.title && (
        <aside className="md:hidden fixed bottom-16 inset-x-0 z-40 px-3 pb-1 pointer-events-none">
          <div 
            onClick={() => setIsMobilePlayerOpen(true)}
            className="pointer-events-auto bg-[#0d1825]/95 backdrop-blur-2xl rounded-2xl p-2.5 shadow-2xl flex items-center justify-between border border-white/10 cursor-pointer"
            style={{ boxShadow: 'rgba(0, 0, 0, 0.6) 0px 10px 30px' }}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#1d1f27] shrink-0 flex items-center justify-center">
                {currentTrack.cover_art_url ? (
                  <img src={currentTrack.cover_art_url} alt={currentTrack.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-[#2563eb] text-[20px]">music_note</span>
                )}
              </div>
              <div className="min-w-0 flex-1 pr-2">
                <p className="font-semibold text-xs text-white truncate">{currentTrack.title}</p>
                <p className="text-[11px] text-[#c3c6d7] truncate">{currentTrack.artist_name || 'Artist'}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button 
                type="button"
                aria-label="Add to playlist"
                title="Add to playlist"
                onClick={() => {
                  if (!isLoggedIn) {
                    setCurrentView('signin');
                    return;
                  }
                  setActivePlaylistTrack(currentTrack);
                  setIsPlaylistModalOpen(true);
                }}
                className="w-9 h-9 flex items-center justify-center text-[#c3c6d7] hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">playlist_add</span>
              </button>
              <button 
                type="button"
                aria-label="Favorite"
                onClick={handleToggleLike}
                className="w-9 h-9 flex items-center justify-center text-[#c3c6d7] hover:text-white transition-colors cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[20px] ${likedTrackIds.includes(currentTrack._id) ? 'fill-1 text-red-500' : ''}`}>
                  favorite
                </span>
              </button>
              <button 
                type="button"
                aria-label="Play/Pause"
                onClick={togglePlay}
                className="w-10 h-10 flex items-center justify-center text-white bg-[#2563eb] rounded-full shadow-lg shadow-[#2563eb]/40 active:scale-95 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px]">
                  {isPlaying ? 'pause' : 'play_arrow'}
                </span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 h-16 pb-safe bg-[#08101a]/95 backdrop-blur-2xl border-t border-white/10 shadow-[0_-1px_8px_rgba(0,0,0,0.04)] flex justify-around items-center px-2">
        <button 
          onClick={() => setCurrentTab('home')} 
          className={`flex flex-col items-center justify-center w-16 h-12 gap-0.5 transition-colors cursor-pointer ${
            currentTab === 'home' ? 'text-[#2563eb] font-semibold' : 'text-[#c3c6d7]'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">home</span>
          <span className="text-[11px]">Home</span>
        </button>
        <button 
          onClick={() => setCurrentTab('discover')} 
          className={`flex flex-col items-center justify-center w-16 h-12 gap-0.5 transition-colors cursor-pointer ${
            currentTab === 'discover' ? 'text-[#2563eb] font-semibold' : 'text-[#c3c6d7]'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">explore</span>
          <span className="text-[11px]">Discover</span>
        </button>
        <button 
          onClick={() => setCurrentTab('artists')} 
          className={`flex flex-col items-center justify-center w-16 h-12 gap-0.5 transition-colors cursor-pointer ${
            (currentTab === 'artists' || currentTab === 'artisthub') ? 'text-[#2563eb] font-semibold' : 'text-[#c3c6d7]'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">person</span>
          <span className="text-[11px]">Artists</span>
        </button>
        <button 
          onClick={() => setCurrentTab('library')} 
          className={`flex flex-col items-center justify-center w-16 h-12 gap-0.5 transition-colors cursor-pointer ${
            currentTab === 'library' ? 'text-[#2563eb] font-semibold' : 'text-[#c3c6d7]'
          }`}
        >
          <span className="material-symbols-outlined text-[24px]">library_music</span>
          <span className="text-[11px]">Library</span>
        </button>
      </nav>

      {/* Mobile Full-Screen Now Playing Overlay */}
      {isMobilePlayerOpen && currentTrack.title && (
        <div className="md:hidden">
          <NowPlayingMobile
            currentTrack={currentTrack}
            tracks={playbackQueue.length > 0 ? playbackQueue : tracks}
            currentTrackIndex={currentQueueIndex}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            isShuffle={isShuffle}
            isRepeat={isRepeat}
            isLiked={likedTrackIds.includes(currentTrack._id)}
            onClose={() => setIsMobilePlayerOpen(false)}
            onPlayPause={togglePlay}
            onNext={handleNextTrack}
            onPrev={handlePrevTrack}
            onSeek={handleSeek}
            onToggleShuffle={() => setIsShuffle(s => !s)}
            onToggleRepeat={() => setIsRepeat(r => !r)}
            onToggleLike={handleToggleLike}
            onAddToPlaylist={() => {
              setActivePlaylistTrack(currentTrack);
              setIsPlaylistModalOpen(true);
            }}
            onSelectArtist={(artistName) => {
              if (artistName) {
                setSelectedArtistName(artistName);
                setCurrentTab('artisthub');
                setIsMobilePlayerOpen(false);
              }
            }}
            onPlayTrack={(track) => playTrackObject(track, playbackQueue.length > 0 ? playbackQueue : tracks)}
          />
        </div>
      )}
    </div>
  );
}