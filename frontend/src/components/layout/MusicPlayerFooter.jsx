// Inside your main HomePage layout or App root:
const [currentTab, setCurrentTab] = useState('home');
const [selectedArtist, setSelectedArtist] = useState(null);

// Handler to jump straight to the artist view from the player
const handleSelectArtistFromPlayer = (artistObj) => {
  setSelectedArtist(artistObj);
  setCurrentTab('artists'); // Switch main view to the Artist tab/hub
};

return (
  <div className="min-h-screen bg-[#08101a] text-on-surface">
    {/* Main Content Conditional Rendering */}
    {currentTab === 'home' && <HomePageContent />}
    
    {currentTab === 'artists' && (
      <ArtistHub 
        artists={artistsList} 
        onPlayTrack={playTrackObject}
        externalSelectedArtist={selectedArtist}
        onSelectArtistStateChange={setSelectedArtist}
      />
    )}

    {/* Persistent Bottom Music Player Footer */}
    <MusicPlayerFooter 
      currentTrack={currentPlayingTrack}
      artists={artistsList}
      onSelectArtist={handleSelectArtistFromPlayer}
      isPlaying={isPlaying}
      onPlayToggle={togglePlayPause}
    />
  </div>
);