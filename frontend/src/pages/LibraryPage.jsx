import React, { useState } from 'react';

export default function LibraryPage({ 
  likedTrackIds, 
  playlists, 
  tracks, 
  artists = [], 
  followedArtistNames = [], 
  onSelectArtist, 
  onPlayTrack, 
  onPlayPlaylist,
  onDeletePlaylist, 
  onCreatePlaylist,
  onRemoveFromPlaylist,
  onToggleLike,
  isLoggedIn,
  onRequireSignIn 
}) {
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const favoritesPlaylist = {
    id: 'favorites-view',
    name: 'Favorite Songs',
    trackIds: likedTrackIds,
    isFavorites: true
  };

  const allLibraryItems = [favoritesPlaylist, ...playlists];
  const activePlaylist = allLibraryItems.find(p => p.id === activePlaylistId);

  const followedArtists = artists.filter(artist => {
    const name = artist.name || artist.artist_name;
    return followedArtistNames.includes(name);
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    if (onCreatePlaylist) {
      onCreatePlaylist(newPlaylistName.trim());
    }
    setNewPlaylistName('');
    setIsCreateModalOpen(false);
  };

  // Detail View: When a playlist is expanded
  if (activePlaylist) {
    const playlistTracks = tracks.filter(t => activePlaylist.trackIds?.includes(t._id));

    return (
      <div className="pt-8 px-8 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-300 relative">
        <button 
          onClick={() => setActivePlaylistId(null)}
          className="flex items-center gap-2 text-[#c3c6d7] hover:text-white transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Library
        </button>

        <div className="flex justify-between items-end flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-black text-white">{activePlaylist.name}</h1>
            <p className="text-[#c3c6d7] mt-2">{playlistTracks.length} tracks</p>
          </div>
          <div className="flex items-center gap-3">
            {playlistTracks.length > 0 && (
              <button 
                onClick={() => {
                  if (onPlayPlaylist) {
                    onPlayPlaylist(playlistTracks, 0);
                  } else {
                    onPlayTrack(playlistTracks[0], playlistTracks, false);
                  }
                }}
                className="bg-[#2563eb] text-white hover:bg-blue-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#2563eb]/20"
              >
                <span className="material-symbols-outlined fill-1 text-sm">play_arrow</span>
                Play Playlist
              </button>
            )}
            {!activePlaylist.isFavorites && (
               <button 
                  onClick={() => setIsConfirmingDelete(true)}
                  className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer"
               >
                 Delete Playlist
               </button>
            )}
          </div>
        </div>

        {playlistTracks.length === 0 ? (
          <div className="bg-[#0d1825]/40 border border-white/5 rounded-3xl p-12 text-center">
            <p className="text-[#c3c6d7]">This playlist is empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {playlistTracks.map((track) => (
              <div 
                key={track._id}
                onClick={() => onPlayTrack(track, playlistTracks, false)}
                className="group cursor-pointer space-y-3 bg-[#0d1825]/40 border border-white/5 p-4 rounded-2xl hover:border-[#2563eb]/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-square rounded-xl overflow-hidden bg-[#08101a] shadow-lg relative mb-3">
                    <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={track.cover_art_url} alt={track.title} />
                    
                    {/* Remove Track Button Overlay */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activePlaylist.isFavorites) {
                          if (onToggleLike) onToggleLike(track._id);
                        } else {
                          if (onRemoveFromPlaylist) onRemoveFromPlaylist(activePlaylist.id, track._id);
                        }
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 shadow-md cursor-pointer"
                      title={activePlaylist.isFavorites ? "Remove from Favourites" : "Remove from Playlist"}
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>

                    {/* Play Button Overlay */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack(track, playlistTracks, false);
                      }}
                      className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#2563eb] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg cursor-pointer hover:bg-blue-600"
                      title="Play Track"
                    >
                      <span className="material-symbols-outlined fill-1 text-sm">play_arrow</span>
                    </button>
                  </div>
                  <h4 className="font-bold text-white text-sm truncate group-hover:text-[#2563eb] transition-colors">{track.title}</h4>
                  <p className="text-[#c3c6d7] text-xs truncate mt-1">{track.artist_name}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Playlist Confirmation Modal */}
        {isConfirmingDelete && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0d1825] border border-white/10 w-full max-w-sm rounded-3xl p-6 space-y-6 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Delete Playlist?</h3>
                <p className="text-xs text-[#c3c6d7]">Are you sure you want to delete &quot;{activePlaylist.name}&quot;? This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsConfirmingDelete(false)}
                  className="flex-1 bg-white/5 text-white hover:bg-white/10 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    onDeletePlaylist(activePlaylist.id);
                    setIsConfirmingDelete(false);
                    setActivePlaylistId(null);
                  }}
                  className="flex-1 bg-red-500 text-white hover:bg-red-600 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer shadow-lg shadow-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Grid View: Default library view
  return (
    <div className="pt-8 px-8 max-w-7xl mx-auto space-y-10 pb-20">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-white">Your Library</h2>
        {isLoggedIn && (
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#2563eb] text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-blue-600 transition-colors cursor-pointer shadow-lg shadow-[#2563eb]/20"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            New Playlist
          </button>
        )}
      </div>

      {/* Playlists Section */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-[#e1e2ed]">Playlists</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {allLibraryItems.map((item) => {
            const itemTracks = tracks.filter(t => item.trackIds?.includes(t._id));
            const firstTrack = itemTracks[0];

            return (
              <div 
                key={item.id}
                onClick={() => setActivePlaylistId(item.id)}
                className="bg-[#0d1825]/40 border border-white/10 rounded-3xl p-4 flex flex-col gap-3 hover:border-[#2563eb]/50 hover:bg-[#0d1825]/80 transition-all cursor-pointer group shadow-xl"
              >
                <div className="w-full aspect-square rounded-2xl overflow-hidden shadow-md border border-white/10 relative bg-[#08101a]">
                  {firstTrack?.cover_art_url ? (
                    <img 
                      src={firstTrack.cover_art_url} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center text-[#c3c6d7] group-hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-4xl">
                        {item.isFavorites ? 'favorite' : 'playlist_play'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-1">
                  <h3 className="font-bold text-white text-base group-hover:text-[#2563eb] transition-colors truncate">{item.name}</h3>
                  <p className="text-xs text-[#c3c6d7] mt-0.5">{item.trackIds.length} songs</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Followed Artists Section */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-[#e1e2ed]">Followed Artists</h3>
        {followedArtists.length === 0 ? (
          <p className="text-sm text-[#c3c6d7]">You haven't followed any artists yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {followedArtists.map((artist) => {
              const artistName = artist.name || artist.artist_name;
              return (
                <div 
                  key={artist._id || artist.id}
                  onClick={() => onSelectArtist && onSelectArtist(artistName)}
                  className="bg-[#0d1825]/40 border border-[#8d90a0]/10 p-4 rounded-2xl hover:border-[#2563eb]/50 transition-all group cursor-pointer text-center space-y-3"
                >
                  <div className="aspect-square rounded-full overflow-hidden mx-auto bg-[#08101a] w-28 h-28 shadow-lg">
                    <img 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      alt={artistName} 
                      src={artist.image_url || artist.image || artist.profile_image || "https://via.placeholder.com/300"} 
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

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d1825] border border-white/10 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Create New Playlist</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-[#c3c6d7] hover:text-white cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#c3c6d7] uppercase tracking-wider">Playlist Name</label>
                <input 
                  type="text"
                  placeholder="e.g., Summer Vibes 2026"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  autoFocus
                  className="w-full bg-[#08101a] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2563eb]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 bg-white/5 text-white hover:bg-white/10 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-[#2563eb] text-white hover:bg-blue-600 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer shadow-lg shadow-[#2563eb]/20"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}