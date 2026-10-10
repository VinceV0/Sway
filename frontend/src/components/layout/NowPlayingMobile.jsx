import React, { useRef, useEffect } from 'react';

export default function NowPlayingMobile({
  currentTrack,
  tracks = [],
  currentTrackIndex = 0,
  isPlaying,
  currentTime,
  duration,
  isShuffle,
  isRepeat,
  isLiked,
  onClose,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onToggleShuffle,
  onToggleRepeat,
  onToggleLike,
  onAddToPlaylist,
  onSelectArtist,
  onPlayTrack,
}) {
  const queueRef = useRef(null);
  const activeQueueItemRef = useRef(null);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Scroll active queue item into view
  useEffect(() => {
    if (activeQueueItemRef.current) {
      activeQueueItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentTrackIndex]);

  const handleScrubberClick = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    onSeek && onSeek(pct * duration);
  };

  const handleScrubberTouch = (e) => {
    if (!duration) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    onSeek && onSeek(pct * duration);
  };

  if (!currentTrack?.title) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-[#08101a] flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="shrink-0 h-16 px-6 flex items-center justify-between bg-[#08101a]/80 backdrop-blur-xl border-b border-white/5">
        <button
          aria-label="Dismiss Player"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center text-[#c3c6d7] hover:text-white transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-[28px]">expand_more</span>
        </button>

        <div className="flex-1 flex flex-col items-center justify-center px-2 overflow-hidden text-center">
          <span className="text-[11px] text-[#c3c6d7] tracking-wider uppercase font-medium truncate">Now Playing</span>
          <span className="text-xs text-white font-semibold truncate">{currentTrack.album_name || currentTrack.artist_name || ''}</span>
        </div>

        <div className="w-11 h-11" /> {/* spacer to balance the dismiss button */}
      </header>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto pb-6">

        {/* Album Art */}
        <div className="relative w-full px-6 flex flex-col items-center mt-4">
          <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center">
            {/* Ambient glow */}
            <div className="absolute inset-4 rounded-3xl bg-blue-600/20 blur-2xl scale-95 pointer-events-none" />
            {/* Art */}
            <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-[#1d1f27]">
              {currentTrack.cover_art_url ? (
                <img
                  alt={currentTrack.title}
                  src={currentTrack.cover_art_url}
                  className="w-full h-full object-cover transition-transform duration-700"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[64px] text-[#2563eb]">album</span>
                </div>
              )}
              {/* Vignette overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#08101a]/40 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Track Meta + Actions */}
          <div className="w-full max-w-[340px] flex items-center justify-between mt-4">
            <div className="flex flex-col min-w-0 pr-3 flex-1">
              <h1 className="text-[22px] font-bold text-white tracking-tight truncate leading-tight">
                {currentTrack.title}
              </h1>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <button
                  onClick={() => onSelectArtist && onSelectArtist(currentTrack.artist_name)}
                  className="text-[#b4c5ff] font-medium text-sm hover:underline truncate"
                >
                  {currentTrack.artist_name}
                </button>
                {currentTrack.genre && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-[#434655] shrink-0" />
                    <span className="text-[11px] text-[#8d90a0]">{currentTrack.genre}</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                aria-label="Add to playlist"
                onClick={onAddToPlaylist}
                className="w-11 h-11 flex items-center justify-center rounded-full text-[#c3c6d7] hover:text-white transition-all active:scale-90"
              >
                <span className="material-symbols-outlined text-[22px]">playlist_add</span>
              </button>
              <button
                aria-label={isLiked ? 'Unlike' : 'Like'}
                onClick={onToggleLike}
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-all active:scale-90 ${isLiked ? 'text-red-400' : 'text-[#c3c6d7] hover:text-red-400'}`}
              >
                <span className={`material-symbols-outlined text-[24px] ${isLiked ? 'fill-1' : ''}`}>
                  favorite
                </span>
              </button>
            </div>
          </div>

          {/* Scrubber */}
          <div className="w-full max-w-[340px] flex flex-col mt-5">
            <div
              role="slider"
              aria-label="Seek"
              aria-valuenow={Math.round(progressPercent)}
              className="relative w-full h-8 flex items-center cursor-pointer group"
              onClick={handleScrubberClick}
              onTouchMove={handleScrubberTouch}
            >
              {/* Track bg */}
              <div className="w-full h-1.5 rounded-full bg-[#32343d] overflow-hidden">
                {/* Filled */}
                <div
                  className="h-full bg-[#2563eb] rounded-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {/* Thumb */}
              <div
                className="absolute -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-md group-hover:scale-125 transition-transform pointer-events-none"
                style={{ left: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between -mt-1">
              <span className="text-[11px] text-[#8d90a0] font-mono">{formatTime(currentTime)}</span>
              <span className="text-[11px] text-[#8d90a0] font-mono">{formatTime(duration || currentTrack.duration_seconds)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="w-full max-w-[340px] flex items-center justify-between mt-4 px-1">
            {/* Shuffle */}
            <button
              aria-label="Shuffle"
              onClick={onToggleShuffle}
              className={`w-11 h-11 flex items-center justify-center transition-all active:scale-90 ${isShuffle ? 'text-[#b4c5ff]' : 'text-[#8d90a0] hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-[22px]">shuffle</span>
            </button>

            {/* Prev */}
            <button
              aria-label="Previous"
              onClick={onPrev}
              className="w-12 h-12 flex items-center justify-center text-white hover:text-[#b4c5ff] active:scale-90 transition-all"
            >
              <span className="material-symbols-outlined text-[34px]">skip_previous</span>
            </button>

            {/* Play / Pause */}
            <button
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={onPlayPause}
              className="w-16 h-16 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-lg shadow-[#2563eb]/40 hover:brightness-110 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[38px]">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            {/* Next */}
            <button
              aria-label="Next"
              onClick={onNext}
              className="w-12 h-12 flex items-center justify-center text-white hover:text-[#b4c5ff] active:scale-90 transition-all"
            >
              <span className="material-symbols-outlined text-[34px]">skip_next</span>
            </button>

            {/* Repeat */}
            <button
              aria-label="Repeat"
              onClick={onToggleRepeat}
              className={`w-11 h-11 flex items-center justify-center transition-all active:scale-90 ${isRepeat ? 'text-[#b4c5ff]' : 'text-[#8d90a0] hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-[22px]">repeat</span>
            </button>
          </div>
        </div>

        {/* Up Next Queue */}
        {tracks.length > 0 && (
          <div className="w-full mt-6 px-4">
            <div className="w-full rounded-2xl bg-[#191b23] shadow-xl p-4 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <span className="text-xs font-bold text-[#b4c5ff] tracking-wider uppercase relative">
                  Up Next
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563eb] rounded-full -mb-3" />
                </span>
                <span className="text-[11px] text-[#8d90a0]">{tracks.length} tracks</span>
              </div>

              {/* Queue list */}
              <div ref={queueRef} className="flex flex-col gap-1 mt-3">
                {tracks.map((track, idx) => {
                  const isCurrent = idx === currentTrackIndex;
                  return (
                    <div
                      key={track._id || idx}
                      ref={isCurrent ? activeQueueItemRef : null}
                      onClick={() => onPlayTrack && onPlayTrack(track)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${
                        isCurrent
                          ? 'bg-[#1d1f27] shadow-sm'
                          : 'hover:bg-[#1d1f27]/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Art / playing indicator */}
                        <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-[#32343d]">
                          {track.cover_art_url ? (
                            <img
                              alt={track.title}
                              src={track.cover_art_url}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-[#8d90a0] text-[20px]">music_note</span>
                            </div>
                          )}
                          {isCurrent && (
                            <div className="absolute inset-0 bg-[#2563eb]/40 flex items-center justify-center">
                              <span className="material-symbols-outlined text-white text-[18px] animate-pulse">volume_up</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-semibold truncate ${isCurrent ? 'text-[#b4c5ff]' : 'text-white'}`}>
                            {track.title}
                          </span>
                          <span className="text-[11px] text-[#8d90a0] truncate">{track.artist_name}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className="text-[11px] text-[#8d90a0] font-mono">
                          {formatTime(track.duration_seconds)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
