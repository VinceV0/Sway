import React from 'react';

export default function Sidebar({ activeTab, onNavigate, playlists = [], onPlayPlaylist }) {
  return (
    <aside className="hidden md:flex w-64 min-h-screen bg-[#0d1825] border-r border-[#8d90a0]/10 flex-col p-6 gap-6 fixed left-0 top-0 z-50">
      <div className="flex items-center gap-2 px-2">
        <h1 className="font-black text-2xl tracking-tighter text-[#2563eb]">Sway</h1>
      </div>

      <nav className="flex flex-col gap-2 mt-4">
        <button
          onClick={() => onNavigate && onNavigate('home')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'home'
              ? 'bg-[#2563eb] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
              : 'text-[#c3c6d7] hover:bg-[#08101a] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">home</span>
          Home
        </button>

        <button
          onClick={() => onNavigate && onNavigate('discover')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'discover'
              ? 'bg-[#2563eb] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
              : 'text-[#c3c6d7] hover:bg-[#08101a] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">explore</span>
          Discover
        </button>

        <button
          onClick={() => onNavigate && onNavigate('artists')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'artists'
              ? 'bg-[#2563eb] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
              : 'text-[#c3c6d7] hover:bg-[#08101a] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">group</span>
          Artists
        </button>

        <button
          onClick={() => onNavigate && onNavigate('library')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'library'
              ? 'bg-[#2563eb] text-white shadow-[0_4px_12px_rgba(37,99,235,0.3)]'
              : 'text-[#c3c6d7] hover:bg-[#08101a] hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">library_music</span>
          Library
        </button>
      </nav>

      {/* Playlists Section */}
      <div className="flex flex-col gap-2 mt-2 pt-6 border-t border-[#8d90a0]/10 flex-1 overflow-hidden">
        <div className="px-2 flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-[#8d90a0] uppercase">Playlists</span>
        </div>
        
        <div className="flex flex-col gap-1 overflow-y-auto pr-1 max-h-[calc(100vh-340px)]">
          {playlists.length === 0 ? (
            <p className="px-2 text-xs text-[#8d90a0] italic">No playlists yet</p>
          ) : (
            playlists.map((playlist) => (
              <button
                key={playlist.id || playlist._id}
                onClick={() => {
                  if (onPlayPlaylist) {
                    onPlayPlaylist(playlist);
                  }
                  if (onNavigate) {
                    onNavigate('library');
                  }
                }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-[#c3c6d7] hover:bg-[#08101a] hover:text-white transition-all text-left truncate w-full cursor-pointer group"
                title={playlist.name}
              >
                <span className="material-symbols-outlined text-[18px] text-[#8d90a0] group-hover:text-[#2563eb] transition-colors">playlist_play</span>
                <span className="truncate">{playlist.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}