/**
 * Sway Music Player — Backend API Integration & UI Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    let isPlaying = false;
    let currentTrackIndex = 0;
    let isScrubbing = false;
    let seekTargetRatio = 0;
    let playlist = []; 
    
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";

    const mainPlayBtn = document.getElementById('mainPlayBtn');
    const playIcon = mainPlayBtn ? mainPlayBtn.querySelector('.material-symbols-outlined') : null;
    
    const footer = document.querySelector('footer');
    const trackCoverImg = footer ? footer.querySelector('img') : null;
    const trackTitleEl = footer ? footer.querySelector('.truncate.text-white') : null;
    const trackArtistEl = footer ? footer.querySelector('.truncate.text-on-surface-variant') : null;
    
    const progressContainer = footer ? footer.querySelector('.flex-1.h-1') : null;
    const progressWrapper = progressContainer ? progressContainer.parentElement : null;
    const progressBar = progressContainer ? progressContainer.querySelector('div') : null;
    const currentTimeEl = footer ? footer.querySelectorAll('.font-mono-sm')[0] : null;
    const totalTimeEl = footer ? footer.querySelectorAll('.font-mono-sm')[1] : null;

    function formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    // 1. Fetch Dynamic Playlist from FastAPI Backend
    async function fetchPlaylistFromBackend() {
        try {
            console.log("🌐 Fetching tracks from API...");
            const response = await fetch('http://127.0.0.1:8000/api/tracks');
            if (!response.ok) throw new Error(`HTTP status ${response.status}`);
            
            const rawTracks = await response.json();
            console.log("📥 Raw tracks received from backend:", rawTracks);
            
            if (rawTracks && rawTracks.length > 0) {
                playlist = rawTracks.map(track => {
                    let audioSrc = track.audio_url || track.url || track.src;
                    if (!audioSrc || audioSrc.includes('cloudflarestorage.com')) {
                        audioSrc = "https://pub-027373b3b40748be8272805554236499.r2.dev/5%20Seconds%20Of%20Summer%20-%20Easier.mp3";
                    }

                    return {
                        id: track._id || track.id || "1",
                        title: track.title || "Untitled Track",
                        artist: track.artist_name || track.artist || "Unknown Artist",
                        album: track.album_name || track.album || "",
                        duration: formatTime(track.duration_seconds || track.duration || 157),
                        durationSec: track.duration_seconds || track.duration || 157,
                        cover: track.cover_art_url || track.cover || "https://via.placeholder.com/300",
                        src: audioSrc
                    };
                });

                console.log(`✅ Mapped ${playlist.length} tracks from backend.`);
                loadTrack(0, false);
            }
        } catch (err) {
            console.error("❌ Failed to fetch tracks from backend, falling back to default playlist:", err);
            loadFallbackPlaylist();
        }
    }

    function loadFallbackPlaylist() {
        playlist = [
            {
                title: "Glass Meridian",
                artist: "Prism Audio",
                duration: "4:08",
                durationSec: 248,
                cover: "https://via.placeholder.com/300",
                src: "https://pub-027373b3b40748be8272805554236499.r2.dev/5%20Seconds%20Of%20Summer%20-%20Easier.mp3"
            }
        ];
        loadTrack(0, false);
    }

    // 2. Load Track Audio as Blob (Fixes 206 range header scrubbing issues)
    async function loadTrack(index, autoPlay = true) {
        if (playlist.length === 0 || index < 0 || index >= playlist.length) return;
        currentTrackIndex = index;
        const track = playlist[index];

        if (trackCoverImg) trackCoverImg.src = track.cover;
        if (trackTitleEl) trackTitleEl.textContent = track.title;
        if (trackArtistEl) trackArtistEl.textContent = track.artist;
        if (totalTimeEl) totalTimeEl.textContent = track.duration;

        try {
            const response = await fetch(track.src);
            const blob = await response.blob();
            
            if (audio.src && audio.src.startsWith('blob:')) {
                URL.revokeObjectURL(audio.src);
            }

            audio.src = URL.createObjectURL(blob);
            audio.load();

            if (autoPlay) {
                playAudio();
            }
        } catch (err) {
            console.error("Failed to load audio blob, falling back to direct URL:", err);
            audio.src = track.src;
            audio.load();
            if (autoPlay) playAudio();
        }
    }

    function playAudio() {
        audio.play().then(() => {
            isPlaying = true;
            updatePlayPauseUI();
        }).catch(err => {
            console.warn("Playback interrupted or network load delay:", err);
            isPlaying = false;
            updatePlayPauseUI();
        });
    }

    function pauseAudio() {
        audio.pause();
        isPlaying = false;
        updatePlayPauseUI();
    }

    function togglePlay() {
        if (!audio.src) {
            loadTrack(0, true);
            return;
        }

        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    }

    // 3. Dynamic Icon Switching UI Sync
    function updatePlayPauseUI() {
        if (playIcon) {
            playIcon.textContent = isPlaying ? 'pause' : 'play_arrow';
        }
        // Fallback for font-awesome style buttons if present in footer
        if (footer) {
            const buttons = footer.querySelectorAll('button');
            buttons.forEach((btn) => {
                const iTag = btn.querySelector('i');
                if (iTag) {
                    if (isPlaying) {
                        iTag.classList.remove('fa-play');
                        iTag.classList.add('fa-pause');
                    } else {
                        iTag.classList.remove('fa-pause');
                        iTag.classList.add('fa-play');
                    }
                }
            });
        }
    }

    function updateVisualScrub(e) {
        if (!progressContainer) return;

        const rect = progressContainer.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        
        let percentage = (clientX - rect.left) / rect.width;
        percentage = Math.max(0, Math.min(1, percentage));

        seekTargetRatio = percentage;

        if (progressBar) progressBar.style.width = `${percentage * 100}%`;
        
        const effectiveDuration = audio.duration || playlist[currentTrackIndex]?.durationSec || 0;
        if (effectiveDuration && isFinite(effectiveDuration)) {
            const previewTime = percentage * effectiveDuration;
            if (currentTimeEl) currentTimeEl.textContent = formatTime(previewTime);
        }
    }

    function applySeek() {
        const effectiveDuration = audio.duration || playlist[currentTrackIndex]?.durationSec || 0;
        if (!effectiveDuration || !isFinite(effectiveDuration)) return;
        
        const targetTime = seekTargetRatio * effectiveDuration;
        
        if (isFinite(targetTime) && targetTime >= 0 && targetTime <= effectiveDuration) {
            audio.currentTime = targetTime;
            if (isPlaying) {
                audio.play().catch(() => {});
            }
        }
    }

    // Audio Event Listeners
    audio.addEventListener('play', () => {
        isPlaying = true;
        updatePlayPauseUI();
    });

    audio.addEventListener('pause', () => {
        isPlaying = false;
        updatePlayPauseUI();
    });

    audio.addEventListener('timeupdate', () => {
        if (isScrubbing || audio.seeking || !audio.duration || !isFinite(audio.duration)) return;
        
        const percent = (audio.currentTime / audio.duration) * 100;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
        let nextIndex = (currentTrackIndex + 1) % playlist.length;
        loadTrack(nextIndex, true);
    });

    // Scrubbing and Interaction Handlers
    if (progressWrapper) {
        const startScrubbing = (e) => {
            if (!audio.src) return;
            isScrubbing = true;
            updateVisualScrub(e);
        };

        const handleMove = (e) => {
            if (isScrubbing) {
                updateVisualScrub(e);
            }
        };

        const stopScrubbing = () => {
            if (isScrubbing) {
                isScrubbing = false;
                applySeek();
            }
        };

        progressWrapper.addEventListener('mousedown', startScrubbing);
        progressWrapper.addEventListener('touchstart', startScrubbing, { passive: true });

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('touchmove', handleMove, { passive: true });

        window.addEventListener('mouseup', stopScrubbing);
        window.addEventListener('touchend', stopScrubbing);

        progressWrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!audio.src) return;
            updateVisualScrub(e);
            applySeek();
        });
    }

    if (mainPlayBtn) {
        mainPlayBtn.addEventListener('click', togglePlay);
    }

    // Bind footer buttons generically if user clicks other control buttons
    if (footer) {
        const footerButtons = footer.querySelectorAll('button');
        footerButtons.forEach((btn) => {
            if (btn !== mainPlayBtn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    togglePlay();
                });
            }
        });
    }

    // Initialize the application by loading from the backend
    fetchPlaylistFromBackend();
});