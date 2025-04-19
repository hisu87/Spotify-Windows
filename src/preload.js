// Preload script runs in a separate context but has access to both Node.js and browser APIs
const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Audio control methods
  playAudio: () => ipcRenderer.send("audio-control", "play"),
  pauseAudio: () => ipcRenderer.send("audio-control", "pause"),
  nextTrack: () => ipcRenderer.send("audio-control", "next"),
  previousTrack: () => ipcRenderer.send("audio-control", "previous"),

  // Playlist management
  loadPlaylist: (playlistId) =>
    ipcRenderer.send("playlist", "load", playlistId),
  createPlaylist: (name) => ipcRenderer.send("playlist", "create", name),
  getAllPlaylists: () => {
    return new Promise((resolve) => {
      ipcRenderer.once("playlist-reply", (_, result) => resolve(result.playlists));
      ipcRenderer.send("playlist", "get-all");
    });
  },

  // Search
  searchTracks: (query) => {
    return new Promise((resolve) => {
      ipcRenderer.once("search-reply", (_, result) => resolve(result));
      ipcRenderer.send("search", query);
    });
  },

  // Album methods - new functionality
  searchAlbums: (query) => {
    return new Promise((resolve) => {
      ipcRenderer.once("search-albums-reply", (_, result) => resolve(result));
      ipcRenderer.send("search-albums", query);
    });
  },

  getAlbumDetails: (albumId, source = "youtube-music") => {
    return new Promise((resolve) => {
      ipcRenderer.once("album-details-reply", (_, result) => resolve(result));
      ipcRenderer.send("get-album-details", albumId, source);
    });
  },

  playAlbum: (albumId, source = "youtube-music") => {
    return new Promise((resolve) => {
      ipcRenderer.once("play-album-reply", (_, result) => resolve(result));
      ipcRenderer.send("play-album", albumId, source);
    });
  },

  // Play specific track
  playTrack: (trackId, source = "local") => {
    return new Promise((resolve) => {
      ipcRenderer.once("play-track-reply", (_, result) => resolve(result));
      ipcRenderer.send("play-track", trackId, source);
    });
  },

  // Home page content - new methods
  getRandomContent: () => {
    return new Promise((resolve) => {
      ipcRenderer.once("random-content-reply", (_, result) => resolve(result));
      ipcRenderer.send("get-random-content");
    });
  },
  
  getRandomTracks: (limit = 5) => {
    return new Promise((resolve) => {
      ipcRenderer.once("random-tracks-reply", (_, result) => resolve(result));
      ipcRenderer.send("get-random-tracks", limit);
    });
  },
  
  getRandomAlbums: (limit = 4) => {
    return new Promise((resolve) => {
      ipcRenderer.once("random-albums-reply", (_, result) => resolve(result));
      ipcRenderer.send("get-random-albums", limit);
    });
  },
  
  getRandomPlaylists: (limit = 4) => {
    return new Promise((resolve) => {
      ipcRenderer.once("random-playlists-reply", (_, result) => resolve(result));
      ipcRenderer.send("get-random-playlists", limit);
    });
  },
  
  getRandomArtists: (limit = 6) => {
    return new Promise((resolve) => {
      ipcRenderer.once("random-artists-reply", (_, result) => resolve(result));
      ipcRenderer.send("get-random-artists", limit);
    });
  },

  // Event listeners
  onTrackChange: (callback) => {
    ipcRenderer.on("track-change", (_, data) => callback(data));
    return () => ipcRenderer.removeListener("track-change", callback);
  },
  onPlaybackStateChange: (callback) => {
    ipcRenderer.on("playback-state-change", (_, data) => callback(data));
    return () => ipcRenderer.removeListener("playback-state-change", callback);
  },
});
