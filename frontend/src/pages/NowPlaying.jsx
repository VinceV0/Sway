import React, { useEffect, useRef } from 'react';

export default function NowPlaying({
  currentTrack,
  tracks = [],
  currentTrackIndex = 0,
  onPlayTrack,
  onClose,
  isLoggedIn,
  likedTrackIds = [],
  onToggleLike,
  onAddToPlaylist,
  onSelectArtist
}) {
  const activeItemRef = useRef(null);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentTrackIndex]);

  const formatTime = (secs) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const isLiked = likedTrackIds.includes(currentTrack?._id);

  return (
    <div className="w-full max-w-4xl 2xl:max-w-5xl mx-auto px-4 sm:px-6 2xl:px-8 py-4 2xl:py-6 space-y-4 2xl:space-y-6 animate-fadeIn text-xs sm:text-sm 2xl:text-base">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 2xl:gap-8 items-center">
        {/* Left: Back Button, Now Playing Title + Album Art & Track Info */}
        <div className="flex flex-col items-center text-center space-y-3 2xl:space-y-4">
          <div className="flex items-center justify-between w-full px-2">
            <button 
              onClick={onClose}
              className="flex items-center gap-1.5 text-[#c3c6d7] hover:text-white transition-colors cursor-pointer bg-white/5 px-3 py-1.5 2xl:px-3.5 2xl:py-2 rounded-xl border border-white/5 font-bold shadow-sm text-xs 2xl:text-sm"
            >
              <span className="material-symbols-outlined text-sm 2xl:text-base">arrow_back</span>
              <span>Back</span>
            </button>
            <h2 className="text-[10px] 2xl:text-xs font-bold text-white tracking-widest uppercase">Now Playing</h2>
            <div className="w-[68px] 2xl:w-[76px]"></div>
          </div>

          <div className="w-44 h-44 sm:w-52 sm:h-52 2xl:w-64 2xl:h-64 rounded-2xl 2xl:rounded-3xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 bg-[#0d1825] relative">
            <img 
              className="w-full h-full object-cover" 
              alt={currentTrack.title} 
              src={currentTrack.cover_art_url || "https://via.placeholder.com/300"} 
            />
          </div>

          <div className="space-y-0.5 2xl:space-y-1 w-full px-4 max-w-md">
            <h1 className="text-lg lg:text-xl 2xl:text-2xl font-bold text-white truncate">{currentTrack.title}</h1>
            <p 
              onClick={(e) => {
                e.stopPropagation();
                if (currentTrack.artist_name && onSelectArtist) {
                  onSelectArtist(currentTrack.artist_name);
                }
              }}
              className="text-xs 2xl:text-sm text-[#c3c6d7] hover:text-white hover:underline cursor-pointer truncate transition-colors inline-block"
              title={`View artist: ${currentTrack.artist_name}`}
            >
              {currentTrack.artist_name || "Unknown Artist"}
            </p>
          </div>

          <div className="flex items-center gap-2.5 2xl:gap-3">
            <button 
              onClick={() => onToggleLike(currentTrack._id)}
              className={`p-2 2xl:p-2.5 rounded-xl border transition-all cursor-pointer shadow-md ${isLiked ? 'bg-red-500/20 border-red-500/30 text-red-500' : 'bg-white/5 border-white/10 text-[#c3c6d7] hover:text-white'}`}
              title={isLoggedIn ? (isLiked ? "Remove from Favourites" : "Add to Favourites") : "Sign in to favourite"}
            >
              <span className={`material-symbols-outlined text-base 2xl:text-lg ${isLiked ? 'fill-1' : ''}`}>favorite</span>
            </button>
            <button 
              onClick={() => onAddToPlaylist(currentTrack)}
              className="p-2 2xl:p-2.5 rounded-xl bg-white/5 border border-white/10 text-[#c3c6d7] hover:text-white transition-all cursor-pointer shadow-md"
              title="Add to Playlist"
            >
              <span className="material-symbols-outlined text-base 2xl:text-lg">playlist_add</span>
            </button>
          </div>
        </div>

        {/* Right: Playback Queue */}
        <div className="bg-[#0d1825]/60 border border-white/5 rounded-2xl 2xl:rounded-3xl p-4 2xl:p-6 space-y-3 2xl:space-y-4 backdrop-blur-md shadow-xl">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-bold text-xs 2xl:text-sm text-white">Playback Queue</h3>
            <span className="text-[10px] 2xl:text-xs text-[#c3c6d7] font-mono">{tracks.length} tracks</span>
          </div>

          <div className="space-y-1.5 2xl:space-y-2 max-h-[300px] lg:max-h-[340px] 2xl:max-h-[420px] overflow-y-auto pr-1">
            {tracks.map((track, idx) => {
              const isCurrent = idx === currentTrackIndex;
              return (
                <div 
                  key={track._id || idx}
                  ref={isCurrent ? activeItemRef : null}
                  onClick={() => onPlayTrack(track)}
                  className={`flex items-center gap-2.5 2xl:gap-3 p-2 2xl:p-3 rounded-xl 2xl:rounded-2xl transition-all cursor-pointer border ${isCurrent ? 'bg-[#2563eb]/20 border-[#2563eb]/40 text-white shadow-md' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] text-[#c3c6d7]'}`}
                >
                  <span className="font-mono text-[10px] 2xl:text-xs w-4 2xl:w-5 text-center">{idx + 1}</span>
                  <div className="w-8 h-8 2xl:w-10 2xl:h-10 rounded-lg 2xl:rounded-xl overflow-hidden bg-[#08101a] flex-shrink-0 shadow-sm">
                    <img className="w-full h-full object-cover" alt={track.title} src={track.cover_art_url} />
                  </div>
                  <div className="flex-1 truncate">
                    <h4 className={`font-bold text-xs 2xl:text-sm truncate ${isCurrent ? 'text-[#2563eb]' : 'text-white'}`}>{track.title}</h4>
                    <p className="text-[10px] 2xl:text-xs truncate mt-0.5">{track.artist_name}</p>
                  </div>
                  <span className="text-[10px] 2xl:text-xs font-mono">{formatTime(track.duration_seconds)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}