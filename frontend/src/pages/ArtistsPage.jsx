import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

export default function ArtistsPage({ onSelectArtist }) {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/artists`)
      .then(res => res.json())
      .then(data => {
        const rawList = Array.isArray(data) ? data : (data.artists || data.data || []);
        // Strictly filter to ensure only artist accounts are displayed
        const artistList = rawList.filter(a => {
          const role = (a.role || '').toLowerCase().trim();
          return role !== 'listener';
        });

        if (artistList.length > 0) {
          const formattedArtists = artistList.map((raw, index) => ({
            _id: raw._id || raw.id || index.toString(),
            name: raw.name || raw.artist_name || "Unknown Artist",
            genre: raw.genre || "Alternative",
            image: raw.profile_pic || raw.image_url || raw.image || "https://via.placeholder.com/300",
            alt: raw.alt || raw.name || "Artist portrait"
          }));
          
          // Randomize/shuffle the artist order on refresh
          const shuffledArtists = formattedArtists.sort(() => Math.random() - 0.5);
          setArtists(shuffledArtists);
        } else {
          setArtists([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching artists:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="pt-8 px-8 max-w-7xl mx-auto space-y-10 pb-20">
      <div className="flex flex-col w-full gap-8 relative">
        <section className="flex flex-col gap-10">
          <div className="flex items-baseline gap-4">
            <h2 className="text-3xl font-black text-white tracking-tight">Trending Directory</h2>
            <div className="h-[1px] flex-grow bg-gradient-to-r from-white/10 to-transparent ml-4"></div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <p className="text-[#c3c6d7] text-sm animate-pulse">Loading artists from database...</p>
            </div>
          ) : artists.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[#c3c6d7] text-sm">No artists found in the database.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {artists.map((artist) => (
                <article 
                  key={artist._id} 
                  onClick={() => {
                    if (onSelectArtist) {
                      onSelectArtist(artist.name, false);
                    }
                  }}
                  className="group flex flex-col items-center text-center cursor-pointer bg-[#0d1825]/40 border border-white/10 p-4 rounded-3xl hover:border-[#2563eb]/50 hover:bg-[#0d1825]/80 transition-all shadow-xl justify-between"
                >
                  <div className="w-full flex flex-col items-center">
                    <div className="relative w-full aspect-square rounded-full mb-4 overflow-hidden bg-[#08101a] shadow-lg border border-white/10">
                      <img 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        alt={artist.alt} 
                        src={artist.image} 
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="w-12 h-12 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: '"FILL" 1' }}>play_arrow</span>
                        </div>
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-white mb-1 group-hover:text-[#2563eb] transition-colors truncate w-full">{artist.name}</h3>
                    <span className="text-xs font-semibold text-[#c3c6d7] uppercase tracking-widest mb-3">{artist.genre}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectArtist) {
                        onSelectArtist(artist.name, true);
                      }
                    }}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 hover:border-blue-500 text-blue-400 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                    title={`Chat with ${artist.name}`}
                  >
                    <span className="material-symbols-outlined text-sm">chat</span>
                    <span>Chat with Artist</span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}