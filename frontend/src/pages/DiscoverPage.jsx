import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config/api';

export default function DiscoverPage({ 
  externalTracks = [], 
  onPlayTrack, 
  onSelectArtist,
  isLoggedIn = false,
  likedTrackIds = [],
  onToggleLike = () => {},
  onAddToPlaylist = () => {},
  onRequireSignIn = () => {}
}) {
  const [tracks, setTracks] = useState(externalTracks);
  const [artists, setArtists] = useState([]);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [genreTracks, setGenreTracks] = useState([]);
  const [loading, setLoading] = useState(externalTracks.length === 0);
  const [error, setError] = useState(null);

  // Ref for horizontal scrolling of artists
  const artistScrollRef = useRef(null);

  // Helper function to randomize array order
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Randomize tracks whenever a genre is selected or tracks update
  useEffect(() => {
    if (selectedGenre) {
      const filtered = tracks.filter(
        (t) => (t.genre || t.genre_name || "Featured").toLowerCase() === selectedGenre.toLowerCase()
      );
      setGenreTracks(shuffleArray(filtered));
    } else {
      setGenreTracks([]);
    }
  }, [selectedGenre, tracks]);

  // Scroll control handler
  const scrollArtists = (direction) => {
    if (artistScrollRef.current) {
      const { scrollLeft, clientWidth } = artistScrollRef.current;
      const scrollAmount = clientWidth * 0.75;
      artistScrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        let trackList = externalTracks;
        if (!trackList || trackList.length === 0) {
          const tracksRes = await fetch(`${API_BASE_URL}/api/tracks`);
          if (!tracksRes.ok) throw new Error('Failed to fetch tracks');
          const tracksData = await tracksRes.json();
          trackList = Array.isArray(tracksData) ? tracksData : (tracksData.tracks || []);
        }
        
        setTracks(trackList);
        processGenres(trackList);

        // Fetch artists from database and shuffle them
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
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Could not load data from database.');
        setLoading(false);
      }
    }

    fetchData();
  }, [externalTracks]);

  const processGenres = (trackList) => {
    const genreMap = {};
    trackList.forEach((track) => {
      const g = track.genre || track.genre_name || "Featured";
      if (!genreMap[g]) {
        genreMap[g] =
          track.cover_art_url ||
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4';
      }
    });

    const formattedGenres = Object.keys(genreMap).map((name) => ({
      name,
      image: genreMap[name],
      alt: `${name} Music`,
    }));

    setGenres(formattedGenres);
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-8 pt-8 text-center text-white">
        <p className="text-xl">Loading discover content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-8 pt-8 text-center text-red-400">
        <p className="text-xl">{error}</p>
      </div>
    );
  }

  if (selectedGenre) {
    const genreArtists = artists.filter(
      (a) => a.genre && a.genre.toLowerCase() === selectedGenre.toLowerCase()
    );

    return (
      <main className="max-w-7xl mx-auto px-8 pt-8 pb-20 text-white space-y-8">
        <button
          onClick={() => setSelectedGenre(null)}
          className="inline-flex items-center text-sm font-semibold text-gray-400 hover:text-blue-500 transition-colors cursor-pointer"
        >
          ← Back to Genres
        </button>

        <header className="space-y-2">
          <p className="text-blue-500 font-semibold tracking-widest uppercase text-sm">
            Genre
          </p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight capitalize">
            {selectedGenre}
          </h1>
        </header>

        {/* Database Artists in this Genre */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              Artists in {selectedGenre}
            </h2>
            {genreArtists.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scrollArtists('left')}
                  className="w-10 h-10 rounded-full bg-gray-800/80 hover:bg-blue-600 text-white flex items-center justify-center transition-colors cursor-pointer border border-gray-700 shadow-md"
                  aria-label="Scroll left"
                >
                  ←
                </button>
                <button
                  onClick={() => scrollArtists('right')}
                  className="w-10 h-10 rounded-full bg-gray-800/80 hover:bg-blue-600 text-white flex items-center justify-center transition-colors cursor-pointer border border-gray-700 shadow-md"
                  aria-label="Scroll right"
                >
                  →
                </button>
              </div>
            )}
          </div>

          {genreArtists.length === 0 ? (
            <p className="text-gray-400">No database artists found for this genre.</p>
          ) : (
            <div
              ref={artistScrollRef}
              className="flex overflow-x-auto gap-6 pb-4 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {genreArtists.map((artist) => {
                const artistName = artist.name || artist.artist_name || artist.artist;
                return (
                  <div
                    key={artist._id || artist.id}
                    onClick={() => {
                      if (onSelectArtist && artistName) {
                        onSelectArtist(artistName);
                      }
                    }}
                    className="flex flex-col items-center text-center group min-w-[130px] sm:min-w-[150px] flex-shrink-0 cursor-pointer"
                  >
                    <div className="w-28 h-28 rounded-full overflow-hidden mb-3 border-2 border-transparent group-hover:border-blue-500 transition-all shadow-lg bg-gray-800">
                      <img
                        src={
                          artist.image_url || 
                          artist.image || 
                          artist.profile_image || 
                          artist.avatar || 
                          artist.photo_url || 
                          artist.imageUrl || 
                          artist.cover_art_url || 
                          artist.cover_image ||
                          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4'
                        }
                        alt={artistName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <h3 className="font-semibold text-sm group-hover:text-blue-500 transition-colors truncate w-full px-2">
                      {artistName}
                    </h3>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Songs in this Genre */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">
            {selectedGenre} Songs
          </h2>
          {genreTracks.length === 0 ? (
            <p className="text-gray-400">No songs found in this genre.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {genreTracks.map((track) => {
                const trackId = track._id || track.id;
                const isLiked = likedTrackIds.includes(trackId);
                return (
                  <div
                    key={trackId}
                    onClick={() => {
                      if (onPlayTrack) {
                        onPlayTrack(track, genreTracks);
                      }
                    }}
                    className="bg-[#0d1825]/60 hover:bg-[#0d1825] p-4 rounded-2xl transition-all duration-300 group border border-gray-800/50 flex flex-col shadow-lg cursor-pointer transform hover:-translate-y-1 justify-between"
                  >
                    <div>
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-4 shadow-md bg-black">
                        <img
                          src={
                            track.cover_art_url ||
                            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4'
                          }
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button className="w-12 h-12 bg-[#2563eb] rounded-full flex items-center justify-center text-white shadow-xl">
                            <span className="material-symbols-outlined fill-1" data-icon="play_arrow">play_arrow</span>
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-lg text-white group-hover:text-blue-500 transition-colors truncate">
                        {track.title}
                      </h3>
                      <p 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectArtist && track.artist_name) {
                            onSelectArtist(track.artist_name);
                          }
                        }}
                        className="text-sm text-gray-400 truncate mt-1 hover:text-white hover:underline transition-colors w-fit"
                      >
                        {track.artist_name}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/40 text-xs text-gray-500" onClick={(e) => e.stopPropagation()}>
                      <span className="truncate max-w-[90px]">
                        {track.album_name || track.album || "Single"}
                      </span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            if (!isLoggedIn) {
                              onRequireSignIn();
                              return;
                            }
                            onToggleLike(trackId);
                          }}
                          className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                          title={isLoggedIn ? (isLiked ? "Remove from Favourites" : "Add to Favourites") : "Sign in to favourite"}
                        >
                          <span className={`material-symbols-outlined text-base ${isLiked ? 'fill-1 text-red-500' : ''}`}>
                            favorite
                          </span>
                        </button>
                        <button 
                          onClick={() => {
                            if (!isLoggedIn) {
                              onRequireSignIn();
                              return;
                            }
                            onAddToPlaylist(track);
                          }}
                          className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                          title="Add to Playlist"
                        >
                          <span className="material-symbols-outlined text-base">playlist_add</span>
                        </button>
                      </div>
                      <span>
                        {formatTime(track.duration_seconds || track.duration || 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-8 pt-8 pb-20 space-y-8">
      <header className="space-y-2">
        <p className="text-blue-500 font-semibold tracking-widest uppercase text-sm">
          Explore
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
          Browse Genres
        </h1>
      </header>

      {genres.length === 0 ? (
        <p className="text-gray-400 text-lg">No genres found in the database.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {genres.map((genre) => (
            <button
              key={genre.name}
              onClick={() => setSelectedGenre(genre.name)}
              className="group relative block rounded-2xl overflow-hidden aspect-[4/3] text-left focus:outline-none transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl w-full cursor-pointer"
            >
              <img
                src={genre.image}
                alt={genre.alt}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08101a]/90 via-[#08101a]/40 to-transparent"></div>
              <div className="absolute inset-0 p-6 flex flex-col justify-end">
                <h2 className="text-3xl font-bold text-white group-hover:text-blue-500 transition-colors duration-300 capitalize">
                  {genre.name}
                </h2>
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}