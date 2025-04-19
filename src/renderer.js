// Renderer process - handles all UI interactions

// UI Elements
const playButton = document.getElementById("play-button");
const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const shuffleButton = document.getElementById("shuffle-button");
const repeatButton = document.getElementById("repeat-button");
const volumeButton = document.getElementById("volume-button");
const progressBar = document.querySelector(".progress-bar");
const progress = document.querySelector(".progress");
const volumeBar = document.querySelector(".volume-bar");
const volumeLevel = document.querySelector(".volume-level");
const currentTime = document.getElementById("current-time");
const totalTime = document.getElementById("total-time");
const currentTrackImg = document.getElementById("current-track-img");
const currentTrackName = document.getElementById("current-track-name");
const currentTrackArtist = document.getElementById("current-track-artist");
const searchInput = document.getElementById("search-input");
const createPlaylistButton = document.getElementById("create-playlist");
const playlistList = document.getElementById("playlist-list");
const mainAppContent = document.getElementById("main-app-content");

// State
let isPlaying = false;
let currentTrack = null;
let currentPlaylist = null;
let shuffle = false;
let repeat = "off"; // 'off', 'all', 'one'
let volume = 0.7;

// Event listeners
playButton.addEventListener("click", togglePlay);
prevButton.addEventListener("click", playPrevious);
nextButton.addEventListener("click", playNext);
shuffleButton.addEventListener("click", toggleShuffle);
repeatButton.addEventListener("click", toggleRepeat);
volumeButton.addEventListener("click", toggleMute);
progressBar.addEventListener("click", seekToPosition);
volumeBar.addEventListener("click", changeVolume);
searchInput.addEventListener("keyup", handleSearch);
createPlaylistButton.addEventListener("click", createNewPlaylist);

// When the page loads, initialize the UI
document.addEventListener("DOMContentLoaded", initializeApp);

// Navigation event listeners
document.querySelectorAll(".nav-item a").forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    const target = event.currentTarget.getAttribute("href").substring(1);
    navigateTo(target);
  });
});

// Player functions
function togglePlay() {
  if (isPlaying) {
    window.electronAPI.pauseAudio();
    playButton.textContent = "Play";
    isPlaying = false;
  } else {
    window.electronAPI.playAudio();
    playButton.textContent = "Pause";
    isPlaying = true;
  }
}

function playPrevious() {
  window.electronAPI.previousTrack();
}

function playNext() {
  window.electronAPI.nextTrack();
}

function toggleShuffle() {
  shuffle = !shuffle;
  shuffleButton.classList.toggle("active", shuffle);
  // Inform main process about shuffle state change
}

function toggleRepeat() {
  if (repeat === "off") {
    repeat = "all";
    repeatButton.textContent = "Repeat All";
  } else if (repeat === "all") {
    repeat = "one";
    repeatButton.textContent = "Repeat One";
  } else {
    repeat = "off";
    repeatButton.textContent = "Repeat";
  }
  // Inform main process about repeat state change
}

function toggleMute() {
  if (volume > 0) {
    volume = 0;
    volumeLevel.style.width = "0%";
    volumeButton.textContent = "Muted";
  } else {
    volume = 0.7;
    volumeLevel.style.width = "70%";
    volumeButton.textContent = "Volume";
  }
  // Inform main process about volume change
}

function seekToPosition(event) {
  const percent = event.offsetX / progressBar.offsetWidth;
  progress.style.width = `${percent * 100}%`;
  // Inform main process to seek to this position
}

function changeVolume(event) {
  const percent = event.offsetX / volumeBar.offsetWidth;
  volume = percent;
  volumeLevel.style.width = `${percent * 100}%`;
  // Inform main process about volume change
}

function handleSearch(event) {
  if (event.key === "Enter") {
    const query = searchInput.value.trim();
    if (query) {
      // Check which tab is active
      const activeTab = document.querySelector(".search-tab.active");
      if (activeTab && activeTab.dataset.tab === "albums") {
        // Search for albums
        window.electronAPI.searchAlbums(query).then((results) => {
          displayAlbumResults(results);
        });
      } else {
        // Search for tracks (default)
        window.electronAPI.searchTracks(query).then((results) => {
          displaySearchResults(results);
        });
      }
    }
  }
}

function createNewPlaylist() {
  const name = prompt("Enter playlist name:");
  if (name) {
    window.electronAPI.createPlaylist(name);
    // Update UI to show the new playlist
    const newPlaylistItem = document.createElement("li");
    newPlaylistItem.textContent = name;
    newPlaylistItem.classList.add("playlist-item");
    playlistList.appendChild(newPlaylistItem);
  }
}

// UI update functions
function updateTrackInfo(track) {
  currentTrackName.textContent = track.name;
  currentTrackArtist.textContent = track.artist;
  currentTrackImg.src = track.albumArt || "assets/new-default-album.png";
  totalTime.textContent = formatTime(track.duration);

  // Add visual indicator for YouTube Music tracks
  if (track.source === "youtube-music") {
    currentTrackName.classList.add("youtube-track");

    // If it's a YouTube track, we could add a small YouTube icon
    if (!document.getElementById("yt-indicator")) {
      const ytIndicator = document.createElement("span");
      ytIndicator.id = "yt-indicator";
      ytIndicator.className = "yt-indicator";
      ytIndicator.textContent = "(YT Music)";
      ytIndicator.style.fontSize = "0.8em";
      ytIndicator.style.marginLeft = "5px";
      ytIndicator.style.color = "red";
      currentTrackName.appendChild(ytIndicator);
    }
  } else {
    currentTrackName.classList.remove("youtube-track");
    const ytIndicator = document.getElementById("yt-indicator");
    if (ytIndicator) ytIndicator.remove();
  }
}

function updatePlaybackState(state) {
  isPlaying = state.isPlaying;
  playButton.textContent = isPlaying ? "Pause" : "Play";
  currentTime.textContent = formatTime(state.currentTime);
  progress.style.width = `${(state.currentTime / state.duration) * 100}%`;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Navigation and content loading
function navigateTo(page) {
  // Mark the active navigation item
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });
  document
    .querySelector(`.nav-item a[href="#${page}"]`)
    .parentElement.classList.add("active");

  // Load the appropriate content
  switch (page) {
    case "home":
      loadHomePage();
      break;
    case "search":
      loadSearchPage();
      break;
    case "library":
      loadLibraryPage();
      break;
    default:
      loadHomePage();
  }
}

function loadHomePage() {
  // Show loading state
  mainAppContent.innerHTML = `
    <h1>Home</h1>
    <div class="loading-content">
      <p>Loading your music...</p>
    </div>
  `;

  // Load random content for the home page
  window.electronAPI.getRandomContent().then(content => {
    const { tracks, albums, playlists, artists } = content;
    
    let html = '<h1>Home</h1>';

    // Featured tracks section
    html += `
      <section class="home-section">
        <div class="section-header">
          <h2>Featured Songs</h2>
          <a href="#" class="see-all">See all</a>
        </div>
        <div class="track-grid">
    `;
    
    tracks.forEach(track => {
      const sourceClass = track.source === "youtube-music" ? "youtube-track" : "local-track";
      const sourceIndicator = track.source === "youtube-music" ? '<span class="source-indicator">YT Music</span>' : '';
      
      html += `
        <div class="track-card ${sourceClass}" data-id="${track.id}" data-source="${track.source || 'local'}">
          <img src="${track.albumArt || 'assets/new-default-album.png'}" alt="${track.name}">
          <div class="track-card-info">
            <div class="track-name">${track.name} ${sourceIndicator}</div>
            <div class="artist-name">${track.artist}</div>
          </div>
        </div>
      `;
    });
    
    html += '</div></section>';

    // Featured albums section
    html += `
      <section class="home-section">
        <div class="section-header">
          <h2>Albums For You</h2>
          <a href="#" class="see-all">See all</a>
        </div>
        <div class="album-grid">
    `;
    
    albums.forEach(album => {
      const sourceClass = album.source === "youtube-music" ? "youtube-album" : "local-album";
      const yearDisplay = album.year ? `(${album.year})` : '';
      
      html += `
        <div class="album-card ${sourceClass}" data-id="${album.id}" data-source="${album.source || 'local'}">
          <div class="album-cover-container">
            <img src="${album.albumArt || 'assets/new-default-album.png'}" alt="${album.name}" class="album-cover">
            <div class="album-hover-play">
              <span class="play-icon">▶</span>
            </div>
          </div>
          <div class="album-info">
            <div class="album-title">${album.name} ${yearDisplay}</div>
            <div class="album-artist">${album.artist}</div>
          </div>
        </div>
      `;
    });
    
    html += '</div></section>';

    // Playlists section
    html += `
      <section class="home-section">
        <div class="section-header">
          <h2>Playlists For You</h2>
          <a href="#" class="see-all">See all</a>
        </div>
        <div class="playlist-grid">
    `;
    
    playlists.forEach(playlist => {
      const sourceClass = playlist.source === "youtube-music" ? "youtube-playlist" : "local-playlist";
      const sourceIndicator = playlist.source === "youtube-music" ? '<span class="source-indicator">YT Music</span>' : '';
      
      html += `
        <div class="playlist-card ${sourceClass}" data-id="${playlist.id}" data-source="${playlist.source || 'local'}">
          <img src="${playlist.thumbnail || 'assets/new-default-playlist.png'}" alt="${playlist.name}">
          <div class="playlist-name">${playlist.name} ${sourceIndicator}</div>
        </div>
      `;
    });
    
    html += '</div></section>';

    // Artists section
    html += `
      <section class="home-section">
        <div class="section-header">
          <h2>Artists You Might Like</h2>
          <a href="#" class="see-all">See all</a>
        </div>
        <div class="artist-grid">
    `;
    
    artists.forEach(artist => {
      const sourceClass = artist.source === "youtube-music" ? "youtube-artist" : "local-artist";
      
      html += `
        <div class="artist-card ${sourceClass}" data-id="${artist.id}" data-source="${artist.source || 'local'}">
          <div class="artist-image-container">
            <img src="${artist.image || 'assets/new-default-album.png'}" alt="${artist.name}" class="artist-image">
          </div>
          <div class="artist-name">${artist.name}</div>
        </div>
      `;
    });
    
    html += '</div></section>';

    // Update the content
    mainAppContent.innerHTML = html;

    // Add event listeners to track cards
    document.querySelectorAll('.track-card').forEach(card => {
      card.addEventListener('click', () => {
        const trackId = card.dataset.id;
        const source = card.dataset.source || 'local';
        
        window.electronAPI.playTrack(trackId, source).then(response => {
          if (response.status === 'success') {
            isPlaying = true;
            playButton.textContent = 'Pause';
          } else {
            console.error('Error playing track:', response.message);
          }
        });
      });
    });

    // Add event listeners to album cards
    document.querySelectorAll('.album-card').forEach(card => {
      card.addEventListener('click', () => {
        const albumId = card.dataset.id;
        const source = card.dataset.source || 'youtube-music';
        
        loadAlbumDetails(albumId, source);
      });
    });

    // Add event listeners to playlist cards
    document.querySelectorAll('.playlist-card').forEach(card => {
      card.addEventListener('click', () => {
        const playlistId = card.dataset.id;
        
        window.electronAPI.loadPlaylist(playlistId);
      });
    });

    // Add event listeners to artist cards (for future functionality)
    document.querySelectorAll('.artist-card').forEach(card => {
      card.addEventListener('click', () => {
        // Future: Show artist page
        alert(`Artist page for ${card.querySelector('.artist-name').textContent} coming soon!`);
      });
    });
  }).catch(error => {
    console.error('Error loading home page content:', error);
    mainAppContent.innerHTML = `
      <h1>Home</h1>
      <div class="error-message">
        <p>Failed to load content. Please try again later.</p>
      </div>
      <div class="track-grid">
        <div class="track-card">
          <img src="assets/new-default-album.png" alt="Album">
          <div class="track-card-info">
            <div class="track-name">Example Track 1</div>
            <div class="artist-name">Example Artist</div>
          </div>
        </div>
        <div class="track-card">
          <img src="assets/new-default-album.png" alt="Album">
          <div class="track-card-info">
            <div class="track-name">Example Track 2</div>
            <div class="artist-name">Example Artist</div>
          </div>
        </div>
      </div>
    `;
  });
}

function loadSearchPage() {
  mainAppContent.innerHTML = `
        <h1>Search</h1>
        <div class="search-tabs">
            <button class="search-tab active" data-tab="tracks">Songs</button>
            <button class="search-tab" data-tab="albums">Albums</button>
        </div>
        
        <div class="search-categories">
            <div class="category-card">Genres & Moods</div>
            <div class="category-card">New Releases</div>
            <div class="category-card">Charts</div>
            <div class="category-card">Podcasts</div>
        </div>
        
        <div id="search-results">
            <!-- Search results will appear here -->
            <h2>Start typing to search</h2>
            <p>Search will use YouTube Music when available</p>
        </div>
    `;

  // Add event listeners for tab switching
  document.querySelectorAll(".search-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      // Set active tab
      document
        .querySelectorAll(".search-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      // Clear search results
      document.getElementById("search-results").innerHTML =
        "<h2>Start typing to search</h2><p>Search will use YouTube Music when available</p>";

      // Update search input placeholder based on active tab
      if (tab.dataset.tab === "albums") {
        searchInput.placeholder = "Search for albums";
      } else {
        searchInput.placeholder = "Search for songs, artists, or albums";
      }
    });
  });
}

function loadLibraryPage() {
  mainAppContent.innerHTML = `
        <h1>Your Library</h1>
        <div class="library-nav">
            <button class="library-nav-button active">Playlists</button>
            <button class="library-nav-button">Artists</button>
            <button class="library-nav-button">Albums</button>
        </div>
        
        <div class="library-content">
            <!-- Library content will be loaded here -->
            <div class="playlist-grid">
                <div class="playlist-card">
                    <img src="assets/new-default-playlist.png" alt="Playlist">
                    <div class="playlist-name">Liked Songs</div>
                </div>
            </div>
        </div>
    `;
}

function displaySearchResults(results) {
  const searchResults = document.getElementById("search-results");
  if (results && results.length > 0) {
    let html = '<h2>Search Results</h2><div class="track-grid">';

    results.forEach((track) => {
      const sourceClass =
        track.source === "youtube-music" ? "youtube-track" : "local-track";
      const sourceIndicator =
        track.source === "youtube-music"
          ? '<span class="source-indicator">YT Music</span>'
          : "";

      html += `
                <div class="track-card ${sourceClass}" data-id="${
        track.id
      }" data-source="${track.source || "local"}">
                    <img src="${
                      track.albumArt || "assets/new-default-album.png"
                    }" alt="${track.name}">
                    <div class="track-card-info">
                        <div class="track-name">${
                          track.name
                        } ${sourceIndicator}</div>
                        <div class="artist-name">${track.artist}</div>
                    </div>
                </div>
            `;
    });

    html += "</div>";
    searchResults.innerHTML = html;

    // Add click event listeners to the track cards
    document.querySelectorAll(".track-card").forEach((card) => {
      card.addEventListener("click", () => {
        const trackId = card.dataset.id;
        const source = card.dataset.source || "local";

        // Play the track from YouTube Music or locally
        window.electronAPI.playTrack(trackId, source).then((response) => {
          if (response.status === "success") {
            // The track change event will update the UI
            isPlaying = true;
            playButton.textContent = "Pause";
          } else {
            console.error("Error playing track:", response.message);
          }
        });
      });
    });
  } else {
    searchResults.innerHTML = "<h2>No results found</h2>";
  }
}

function displayAlbumResults(albums) {
  const searchResults = document.getElementById("search-results");
  if (albums && albums.length > 0) {
    let html = '<h2>Album Results</h2><div class="album-grid">';

    albums.forEach((album) => {
      const sourceClass =
        album.source === "youtube-music" ? "youtube-album" : "local-album";
      const sourceIndicator =
        album.source === "youtube-music"
          ? '<span class="source-indicator">YT Music</span>'
          : "";
      const yearDisplay = album.year ? `(${album.year})` : "";

      html += `
        <div class="album-card ${sourceClass}" data-id="${
        album.id
      }" data-source="${album.source || "local"}">
          <div class="album-cover-container">
            <img src="${
              album.albumArt || "assets/new-default-album.png"
            }" alt="${album.name}" class="album-cover">
            <div class="album-hover-play">
              <span class="play-icon">▶</span>
            </div>
          </div>
          <div class="album-info">
            <div class="album-title">${
              album.name
            } ${yearDisplay} ${sourceIndicator}</div>
            <div class="album-artist">${album.artist}</div>
          </div>
        </div>
      `;
    });

    html += "</div>";
    searchResults.innerHTML = html;

    // Add click event listeners to the album cards
    document.querySelectorAll(".album-card").forEach((card) => {
      card.addEventListener("click", () => {
        const albumId = card.dataset.id;
        const source = card.dataset.source || "youtube-music";

        // Load and display album details
        loadAlbumDetails(albumId, source);
      });
    });
  } else {
    searchResults.innerHTML = "<h2>No albums found</h2>";
  }
}

async function loadAlbumDetails(albumId, source = "youtube-music") {
  try {
    // Show loading indicator
    const searchResults = document.getElementById("search-results");
    searchResults.innerHTML = "<h2>Loading album...</h2>";

    // Get album details from main process
    const result = await window.electronAPI.getAlbumDetails(albumId, source);

    if (result.status === "success" && result.album) {
      const album = result.album;

      // Create album view
      let html = `
        <div class="album-details">
          <div class="album-header">
            <img src="${
              album.albumArt || "assets/new-default-album.png"
            }" alt="${album.name}" class="album-header-cover">
            <div class="album-header-info">
              <h2>${album.name}</h2>
              <div class="album-artist">${album.artist}</div>
              <div class="album-year">${album.year || ""}</div>
              <div class="album-tracks-count">${
                album.tracks ? album.tracks.length : 0
              } songs</div>
              <button class="play-album-button" data-id="${
                album.id
              }" data-source="${source}">Play Album</button>
            </div>
          </div>
          <div class="album-description">${album.description || ""}</div>
          
          <div class="album-tracks">
            <h3>Tracks</h3>
            <table class="tracks-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
      `;

      // Add tracks
      if (album.tracks && album.tracks.length > 0) {
        album.tracks.forEach((track, index) => {
          html += `
            <tr class="track-row" data-id="${track.id}" data-source="${
            track.source || "youtube-music"
          }">
              <td class="track-number">${track.trackNumber || index + 1}</td>
              <td class="track-title">${track.name}</td>
              <td class="track-duration">${formatTime(track.duration)}</td>
            </tr>
          `;
        });
      } else {
        html += `<tr><td colspan="3">No tracks available</td></tr>`;
      }

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;

      searchResults.innerHTML = html;

      // Add event listener to play album button
      document
        .querySelector(".play-album-button")
        .addEventListener("click", () => {
          playAlbum(albumId, source);
        });

      // Add event listeners to track rows
      document.querySelectorAll(".track-row").forEach((row) => {
        row.addEventListener("click", () => {
          const trackId = row.dataset.id;
          const trackSource = row.dataset.source;

          if (trackId && trackSource) {
            window.electronAPI
              .playTrack(trackId, trackSource)
              .then((response) => {
                if (response.status === "success") {
                  isPlaying = true;
                  playButton.textContent = "Pause";
                } else {
                  console.error("Error playing track:", response.message);
                }
              });
          }
        });
      });
    } else {
      searchResults.innerHTML = `<h2>Error loading album</h2><p>${
        result.message || "Unknown error"
      }</p>`;
    }
  } catch (error) {
    const searchResults = document.getElementById("search-results");
    searchResults.innerHTML = `<h2>Error loading album</h2><p>${error.message}</p>`;
  }
}

async function playAlbum(albumId, source = "youtube-music") {
  try {
    const playButton = document.querySelector(".play-album-button");
    playButton.textContent = "Loading...";
    playButton.disabled = true;

    const result = await window.electronAPI.playAlbum(albumId, source);

    if (result.status === "success") {
      isPlaying = true;
      document.getElementById("play-button").textContent = "Pause";
      playButton.textContent = "Now Playing";
    } else {
      playButton.textContent = "Play Album";
      playButton.disabled = false;
      console.error("Error playing album:", result.message);
      alert(`Error playing album: ${result.message}`);
    }
  } catch (error) {
    console.error("Error playing album:", error);
    const playButton = document.querySelector(".play-album-button");
    playButton.textContent = "Play Album";
    playButton.disabled = false;
  }
}

// Initialize app
async function initializeApp() {
  // Load the home page by default
  loadHomePage();

  // Register event listeners for track changes
  window.electronAPI.onTrackChange((track) => {
    updateTrackInfo(track);
  });

  window.electronAPI.onPlaybackStateChange((state) => {
    updatePlaybackState(state);
  });

  // Get all playlists (including YouTube Music playlists)
  try {
    const playlists = await window.electronAPI.getAllPlaylists();
    updatePlaylistList(playlists);
  } catch (error) {
    console.error("Error loading playlists:", error);

    // Fallback to demo playlists
    ["My Playlist #1", "Favorites", "Workout Mix", "Chill Vibes"].forEach(
      (name) => {
        const playlistItem = document.createElement("li");
        playlistItem.textContent = name;
        playlistItem.classList.add("playlist-item");
        playlistList.appendChild(playlistItem);
      }
    );
  }
}

// Helper function to update playlist list in the UI
function updatePlaylistList(playlists) {
  // Clear existing playlists
  playlistList.innerHTML = "";

  // Add playlists to the UI
  if (playlists && playlists.length > 0) {
    playlists.forEach((playlist) => {
      const playlistItem = document.createElement("li");
      playlistItem.textContent = playlist.name;
      playlistItem.classList.add("playlist-item");

      // Add YouTube Music indicator if it's a YouTube Music playlist
      if (playlist.source === "youtube-music") {
        playlistItem.classList.add("youtube-playlist");
      }

      // Add click handler to load playlist
      playlistItem.addEventListener("click", () => {
        window.electronAPI.loadPlaylist(playlist.id);
      });

      playlistList.appendChild(playlistItem);
    });
  }
}
