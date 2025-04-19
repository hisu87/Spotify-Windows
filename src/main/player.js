// Music player functionality for Spotify Windows App

const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const youtubeMusic = require("../services/youtubeMusic");

// This is a player implementation that can use both demo tracks and YouTube Music

class MusicPlayer {
  constructor() {
    this.currentTrack = null;
    this.queue = [];
    this.isPlaying = false;
    this.currentTime = 0;
    this.playlists = [];
    this.volume = 0.7;
    this.shuffle = false;
    this.repeat = "off"; // off, all, one
    this.currentSource = "local"; // local or youtube-music
    this.isYoutubeMusicInitialized = false;

    // Demo tracks (for local playback when YouTube Music isn't available)
    this.library = [
      {
        id: "1",
        name: "Imagine",
        artist: "John Lennon",
        album: "Imagine",
        duration: 183,
        albumArt: "assets/new-default-album.png",
        source: "local",
      },
      {
        id: "2",
        name: "Shape of You",
        artist: "Ed Sheeran",
        album: "Divide",
        duration: 235,
        albumArt: "assets/new-default-album.png",
        source: "local",
      },
      {
        id: "3",
        name: "Bohemian Rhapsody",
        artist: "Queen",
        album: "A Night at the Opera",
        duration: 354,
        albumArt: "assets/new-default-album.png",
        source: "local",
      },
      {
        id: "4",
        name: "Billie Jean",
        artist: "Michael Jackson",
        album: "Thriller",
        duration: 294,
        albumArt: "assets/new-default-album.png",
        source: "local",
      },
    ];
  }

  async init(window) {
    this.window = window;
    this.setupIpcHandlers();

    // Initialize YouTube Music API
    try {
      this.isYoutubeMusicInitialized = await youtubeMusic.initialize();
      if (this.isYoutubeMusicInitialized) {
        console.log("YouTube Music API initialized successfully");
      } else {
        console.warn(
          "Failed to initialize YouTube Music API, falling back to demo tracks"
        );
      }
    } catch (error) {
      console.error("Error initializing YouTube Music API:", error);
      this.isYoutubeMusicInitialized = false;
    }

    // Demo playlists
    this.playlists = [
      {
        id: "playlist1",
        name: "My Playlist #1",
        tracks: ["1", "3"],
      },
      {
        id: "playlist2",
        name: "Favorites",
        tracks: ["2", "4"],
      },
      {
        id: "playlist3",
        name: "Workout Mix",
        tracks: ["1", "2", "4"],
      },
      {
        id: "playlist4",
        name: "Chill Vibes",
        tracks: ["1", "3"],
      },
    ];
  }

  setupIpcHandlers() {
    // Play/pause/next/previous
    ipcMain.on("audio-control", (event, command) => {
      switch (command) {
        case "play":
          this.play();
          break;
        case "pause":
          this.pause();
          break;
        case "next":
          this.next();
          break;
        case "previous":
          this.previous();
          break;
      }

      event.reply("audio-control-reply", { status: "success", command });
    });

    // Playlist management
    ipcMain.on("playlist", (event, action, data) => {
      if (action === "load") {
        this.loadPlaylist(data);
        event.reply("playlist-reply", {
          status: "success",
          action,
          playlistId: data,
        });
      } else if (action === "create") {
        const playlist = this.createPlaylist(data);
        event.reply("playlist-reply", { status: "success", action, playlist });
      } else if (action === "get-all") {
        this.getPlaylists().then((playlists) => {
          event.reply("playlist-reply", {
            status: "success",
            action,
            playlists,
          });
        });
      }
    });

    // Search - now with YouTube Music support
    ipcMain.on("search", async (event, query) => {
      try {
        let results = [];

        if (this.isYoutubeMusicInitialized && query) {
          console.log(`Player: Starting YouTube Music search for "${query}"`);

          // Search YouTube Music with better error handling
          try {
            const ytResults = await youtubeMusic.search(query);
            console.log(
              `Player: YouTube Music search completed. Found ${ytResults.length} results.`
            );

            if (ytResults && ytResults.length > 0) {
              results = ytResults;

              // For debugging - log the first result
              if (ytResults[0]) {
                console.log(
                  "Player: First search result sample:",
                  JSON.stringify({
                    id: ytResults[0].id,
                    name: ytResults[0].name,
                    artist: ytResults[0].artist,
                    source: ytResults[0].source,
                  })
                );
              }
            } else {
              console.log(
                "Player: YouTube Music search returned no results, falling back to local search"
              );
              results = this.searchLocalTracks(query);
            }
          } catch (ytError) {
            console.error("Player: YouTube Music search failed:", ytError);
            results = this.searchLocalTracks(query);
          }
        } else {
          // Fall back to local search if YouTube Music is not available
          console.log(
            `Player: Using local search for "${query}" (YT Music initialized: ${this.isYoutubeMusicInitialized})`
          );
          results = this.searchLocalTracks(query);
        }

        console.log(
          `Player: Sending ${results.length} total search results to renderer`
        );
        event.reply("search-reply", results);
      } catch (error) {
        console.error("Player: Search error:", error);
        event.reply("search-reply", []);
      }
    });

    // Play specific track by ID
    ipcMain.on("play-track", async (event, trackId, source = "local") => {
      try {
        if (source === "youtube-music" && this.isYoutubeMusicInitialized) {
          const success = await this.playYouTubeMusicTrack(trackId);
          event.reply("play-track-reply", {
            status: success ? "success" : "error",
            trackId,
          });
        } else {
          this.playLocalTrack(trackId);
          event.reply("play-track-reply", { status: "success", trackId });
        }
      } catch (error) {
        console.error("Error playing track:", error);
        event.reply("play-track-reply", {
          status: "error",
          message: error.message,
        });
      }
    });

    // Search for albums in YouTube Music
    ipcMain.on("search-albums", async (event, query) => {
      try {
        let results = [];

        if (this.isYoutubeMusicInitialized && query) {
          console.log(`Player: Searching for albums with query "${query}"`);

          try {
            // Get albums from YouTube Music
            const ytAlbums = await youtubeMusic.searchAlbums(query);
            console.log(
              `Player: Found ${ytAlbums.length} albums from YouTube Music`
            );

            if (ytAlbums && ytAlbums.length > 0) {
              results = ytAlbums;
              // For debugging - log the first result
              if (ytAlbums[0]) {
                console.log(
                  "Player: First album result:",
                  JSON.stringify({
                    id: ytAlbums[0].id,
                    name: ytAlbums[0].name,
                    artist: ytAlbums[0].artist,
                    source: ytAlbums[0].source,
                  })
                );
              }
            }
          } catch (error) {
            console.error("Player: Error searching for albums:", error);
          }
        }

        // Send results to the renderer
        console.log(
          `Player: Sending ${results.length} album results to renderer`
        );
        event.reply("search-albums-reply", results);
      } catch (error) {
        console.error("Player: Album search error:", error);
        event.reply("search-albums-reply", []);
      }
    });

    // Get album details
    ipcMain.on(
      "get-album-details",
      async (event, albumId, source = "youtube-music") => {
        try {
          if (
            source === "youtube-music" &&
            this.isYoutubeMusicInitialized &&
            albumId
          ) {
            console.log(`Player: Getting album details for ID: ${albumId}`);

            const albumDetails = await youtubeMusic.getAlbumDetails(albumId);
            console.log(
              `Player: Received album with ${albumDetails.tracks.length} tracks`
            );

            // Add all tracks to queue for playback
            this.queue = albumDetails.tracks;

            event.reply("album-details-reply", {
              status: "success",
              album: albumDetails,
            });
          } else {
            event.reply("album-details-reply", {
              status: "error",
              message: "Album not found or YouTube Music is not initialized",
            });
          }
        } catch (error) {
          console.error("Player: Error getting album details:", error);
          event.reply("album-details-reply", {
            status: "error",
            message: error.message,
          });
        }
      }
    );

    // Play entire album
    ipcMain.on(
      "play-album",
      async (event, albumId, source = "youtube-music") => {
        try {
          if (
            source === "youtube-music" &&
            this.isYoutubeMusicInitialized &&
            albumId
          ) {
            console.log(`Player: Getting album for playback, ID: ${albumId}`);

            // Get album details
            const albumDetails = await youtubeMusic.getAlbumDetails(albumId);

            if (
              albumDetails &&
              albumDetails.tracks &&
              albumDetails.tracks.length > 0
            ) {
              // Add all tracks to queue for playback
              this.queue = albumDetails.tracks;

              // Play the first track
              const firstTrack = albumDetails.tracks[0];
              if (firstTrack && firstTrack.id) {
                const success = await this.playYouTubeMusicTrack(firstTrack.id);

                event.reply("play-album-reply", {
                  status: success ? "success" : "error",
                  albumId,
                  trackCount: albumDetails.tracks.length,
                });
              } else {
                event.reply("play-album-reply", {
                  status: "error",
                  message: "Album has no playable tracks",
                });
              }
            } else {
              event.reply("play-album-reply", {
                status: "error",
                message: "No tracks found in album",
              });
            }
          } else {
            event.reply("play-album-reply", {
              status: "error",
              message: "Album not found or YouTube Music is not initialized",
            });
          }
        } catch (error) {
          console.error("Player: Error playing album:", error);
          event.reply("play-album-reply", {
            status: "error",
            message: error.message,
          });
        }
      }
    );

    // Home page random content handlers
    ipcMain.on("get-random-content", async (event) => {
      try {
        const randomContent = await this.getRandomContentForHomePage();
        event.reply("random-content-reply", randomContent);
      } catch (error) {
        console.error("Error getting random content:", error);
        event.reply("random-content-reply", {
          tracks: [],
          albums: [],
          playlists: [],
          artists: []
        });
      }
    });

    ipcMain.on("get-random-tracks", async (event, limit = 5) => {
      try {
        const tracks = await this.getRandomTracks(limit);
        event.reply("random-tracks-reply", tracks);
      } catch (error) {
        console.error("Error getting random tracks:", error);
        event.reply("random-tracks-reply", []);
      }
    });

    ipcMain.on("get-random-albums", async (event, limit = 4) => {
      try {
        const albums = await this.getRandomAlbums(limit);
        event.reply("random-albums-reply", albums);
      } catch (error) {
        console.error("Error getting random albums:", error);
        event.reply("random-albums-reply", []);
      }
    });

    ipcMain.on("get-random-playlists", async (event, limit = 4) => {
      try {
        const playlists = await this.getRandomPlaylists(limit);
        event.reply("random-playlists-reply", playlists);
      } catch (error) {
        console.error("Error getting random playlists:", error);
        event.reply("random-playlists-reply", []);
      }
    });

    ipcMain.on("get-random-artists", async (event, limit = 6) => {
      try {
        const artists = await this.getRandomArtists(limit);
        event.reply("random-artists-reply", artists);
      } catch (error) {
        console.error("Error getting random artists:", error);
        event.reply("random-artists-reply", []);
      }
    });
  }

  // Play control functions
  async play() {
    if (this.currentTrack) {
      if (
        this.currentTrack.source === "youtube-music" &&
        this.isYoutubeMusicInitialized
      ) {
        if (youtubeMusic.isPlaying) {
          youtubeMusic.resumePlayback();
        } else {
          await youtubeMusic.playTrack(this.currentTrack.id);
        }
        this.isPlaying = true;
        this.updatePlaybackState();
      } else {
        // Local playback (demo)
        this.isPlaying = true;
        this.updatePlaybackState();

        this.playbackInterval = setInterval(() => {
          if (this.currentTime < this.currentTrack.duration) {
            this.currentTime++;
            this.updatePlaybackState();
          } else {
            this.next();
          }
        }, 1000);
      }
    } else if (this.library.length > 0) {
      // If no track is selected, play the first one
      this.currentTrack = this.library[0];
      this.play();
    }
  }

  pause() {
    if (
      this.currentTrack &&
      this.currentTrack.source === "youtube-music" &&
      this.isYoutubeMusicInitialized
    ) {
      youtubeMusic.pausePlayback();
      this.isPlaying = false;
      this.updatePlaybackState();
    } else {
      // Local playback (demo)
      this.isPlaying = false;
      clearInterval(this.playbackInterval);
      this.updatePlaybackState();
    }
  }

  // Additional functions for YouTube Music
  async playYouTubeMusicTrack(trackId) {
    try {
      // Stop any current playback
      this.stopCurrentPlayback();

      const success = await youtubeMusic.playTrack(trackId);

      if (success) {
        this.currentTrack = youtubeMusic.currentTrack;
        this.currentSource = "youtube-music";
        this.isPlaying = true;

        // Update the UI with the current track
        this.notifyTrackChange();

        // Set up synchronization with YouTube Music playback state
        this.youtubePlaybackSyncInterval = setInterval(() => {
          const state = youtubeMusic.getPlaybackState();
          this.currentTime = state.currentTime;
          this.updatePlaybackState();

          // Check if track ended
          if (state.currentTime >= state.duration && state.duration > 0) {
            this.next();
          }
        }, 1000);

        return true;
      }
      return false;
    } catch (error) {
      console.error("Error playing YouTube Music track:", error);
      return false;
    }
  }

  playLocalTrack(trackId) {
    // Stop any current playback
    this.stopCurrentPlayback();

    // Find and play the local track
    const track = this.library.find((t) => t.id === trackId);
    if (track) {
      this.currentTrack = track;
      this.currentSource = "local";
      this.currentTime = 0;
      this.play();
      this.notifyTrackChange();
      return true;
    }
    return false;
  }

  stopCurrentPlayback() {
    if (
      this.currentSource === "youtube-music" &&
      this.isYoutubeMusicInitialized
    ) {
      youtubeMusic.stopPlayback();
      clearInterval(this.youtubePlaybackSyncInterval);
    } else {
      clearInterval(this.playbackInterval);
    }
    this.isPlaying = false;
  }

  // Next/previous functions need to handle both sources
  next() {
    if (!this.currentTrack) return;

    if (this.currentSource === "youtube-music" && this.queue.length > 0) {
      // Find current track in queue and play next one
      const currentIndex = this.queue.findIndex(
        (track) => track.id === this.currentTrack.id
      );
      if (currentIndex >= 0 && currentIndex < this.queue.length - 1) {
        const nextTrack = this.queue[currentIndex + 1];
        this.playTrackFromSource(nextTrack.id, nextTrack.source);
      } else {
        // Loop back to the beginning if at the end
        if (this.queue.length > 0) {
          const nextTrack = this.queue[0];
          this.playTrackFromSource(nextTrack.id, nextTrack.source);
        }
      }
    } else {
      // Local library fallback
      const currentIndex = this.library.findIndex(
        (track) => track.id === this.currentTrack.id
      );
      const nextIndex = (currentIndex + 1) % this.library.length;

      this.currentTrack = this.library[nextIndex];
      this.currentTime = 0;

      if (this.isPlaying) {
        clearInterval(this.playbackInterval);
        this.play();
      }

      this.notifyTrackChange();
    }
  }

  previous() {
    if (!this.currentTrack) return;

    // If we're more than 3 seconds into the song, restart it
    if (this.currentTime > 3) {
      if (
        this.currentSource === "youtube-music" &&
        this.isYoutubeMusicInitialized
      ) {
        youtubeMusic.stopPlayback();
        youtubeMusic.playTrack(this.currentTrack.id);
      } else {
        this.currentTime = 0;
        this.updatePlaybackState();
      }
      return;
    }

    if (this.currentSource === "youtube-music" && this.queue.length > 0) {
      // Find current track in queue and play previous one
      const currentIndex = this.queue.findIndex(
        (track) => track.id === this.currentTrack.id
      );
      if (currentIndex > 0) {
        const prevTrack = this.queue[currentIndex - 1];
        this.playTrackFromSource(prevTrack.id, prevTrack.source);
      } else {
        // Loop to the end if at the beginning
        if (this.queue.length > 0) {
          const prevTrack = this.queue[this.queue.length - 1];
          this.playTrackFromSource(prevTrack.id, prevTrack.source);
        }
      }
    } else {
      // Local library fallback
      const currentIndex = this.library.findIndex(
        (track) => track.id === this.currentTrack.id
      );
      const previousIndex =
        (currentIndex - 1 + this.library.length) % this.library.length;

      this.currentTrack = this.library[previousIndex];
      this.currentTime = 0;

      if (this.isPlaying) {
        clearInterval(this.playbackInterval);
        this.play();
      }

      this.notifyTrackChange();
    }
  }

  async playTrackFromSource(trackId, source) {
    if (source === "youtube-music" && this.isYoutubeMusicInitialized) {
      return this.playYouTubeMusicTrack(trackId);
    } else {
      return this.playLocalTrack(trackId);
    }
  }

  // Search functions
  searchLocalTracks(query) {
    if (!query) return [];

    query = query.toLowerCase();
    return this.library.filter(
      (track) =>
        track.name.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.album.toLowerCase().includes(query)
    );
  }

  // Playlist functions
  async loadPlaylist(playlistId) {
    // Check if it's a YouTube Music playlist
    if (playlistId.startsWith("YT_") && this.isYoutubeMusicInitialized) {
      try {
        const ytPlaylistId = playlistId.substring(3); // Remove YT_ prefix
        const tracks = await youtubeMusic.getPlaylistTracks(ytPlaylistId);
        this.queue = tracks;

        if (this.queue.length > 0) {
          this.currentTrack = this.queue[0];
          this.currentTime = 0;
          this.notifyTrackChange();
        }
      } catch (error) {
        console.error("Error loading YouTube Music playlist:", error);
      }
    } else {
      // Local playlist
      const playlist = this.playlists.find((p) => p.id === playlistId);
      if (playlist) {
        this.queue = playlist.tracks
          .map((trackId) => this.library.find((track) => track.id === trackId))
          .filter(Boolean);

        if (this.queue.length > 0) {
          this.currentTrack = this.queue[0];
          this.currentTime = 0;
          this.notifyTrackChange();
        }
      }
    }
  }

  async getPlaylists() {
    let playlists = [...this.playlists]; // Start with local playlists

    // Add YouTube Music playlists if available
    if (this.isYoutubeMusicInitialized) {
      try {
        const ytPlaylists = await youtubeMusic.getPlaylists();
        const formattedYtPlaylists = ytPlaylists.map((p) => ({
          id: `YT_${p.id}`, // Prefix with YT_ to distinguish
          name: `[YT] ${p.name}`,
          thumbnail: p.thumbnail || "assets/new-default-playlist.png",
          source: "youtube-music",
        }));
        playlists = [...playlists, ...formattedYtPlaylists];
      } catch (error) {
        console.error("Error getting YouTube Music playlists:", error);
      }
    }

    return playlists;
  }

  // Helper functions to update UI
  updatePlaybackState() {
    if (!this.window) return;

    if (
      this.currentSource === "youtube-music" &&
      this.isYoutubeMusicInitialized
    ) {
      const state = youtubeMusic.getPlaybackState();
      this.window.webContents.send("playback-state-change", {
        isPlaying: state.isPlaying,
        currentTime: state.currentTime,
        duration: state.duration,
      });
    } else {
      this.window.webContents.send("playback-state-change", {
        isPlaying: this.isPlaying,
        currentTime: this.currentTime,
        duration: this.currentTrack ? this.currentTrack.duration : 0,
      });
    }
  }

  notifyTrackChange() {
    if (!this.window || !this.currentTrack) return;

    this.window.webContents.send("track-change", this.currentTrack);
  }

  // Clean up
  cleanup() {
    clearInterval(this.playbackInterval);
    if (this.youtubePlaybackSyncInterval) {
      clearInterval(this.youtubePlaybackSyncInterval);
    }
    if (this.isYoutubeMusicInitialized) {
      youtubeMusic.cleanup();
    }
  }

  // New methods for random content
  async getRandomContentForHomePage() {
    return {
      tracks: await this.getRandomTracks(5),
      albums: await this.getRandomAlbums(4),
      playlists: await this.getRandomPlaylists(4),
      artists: await this.getRandomArtists(6)
    };
  }

  async getRandomTracks(limit = 5) {
    let tracks = [...this.library]; // Start with local library

    // If YouTube Music is initialized, try to get some tracks from there too
    if (this.isYoutubeMusicInitialized) {
      try {
        // Use different popular queries to get random tracks
        const queries = ["top hits", "popular 2025", "trending music", "viral hits", "best songs"];
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        
        const ytTracks = await youtubeMusic.search(randomQuery, 10);
        if (ytTracks && ytTracks.length > 0) {
          tracks = [...tracks, ...ytTracks];
        }
      } catch (error) {
        console.error("Error getting YouTube Music tracks:", error);
      }
    }
    
    // Shuffle the tracks
    tracks = this.shuffleArray(tracks);
    
    // Return the requested number of tracks
    return tracks.slice(0, limit);
  }

  async getRandomAlbums(limit = 4) {
    let albums = [];

    // Try to get albums from YouTube Music
    if (this.isYoutubeMusicInitialized) {
      try {
        // Use different album queries to get random albums
        const queries = ["best albums", "new releases", "popular albums", "classic albums"];
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        
        const ytAlbums = await youtubeMusic.searchAlbums(randomQuery, 10);
        if (ytAlbums && ytAlbums.length > 0) {
          albums = [...albums, ...ytAlbums];
        }
        
        // If we don't have enough albums, try another query
        if (albums.length < limit) {
          const secondQuery = "top albums 2025";
          const moreAlbums = await youtubeMusic.searchAlbums(secondQuery, 10);
          if (moreAlbums && moreAlbums.length > 0) {
            albums = [...albums, ...moreAlbums];
          }
        }
      } catch (error) {
        console.error("Error getting YouTube Music albums:", error);
      }
    }
    
    // If we still don't have albums or YouTube Music isn't available, add some demo albums
    if (albums.length === 0) {
      albums = [
        {
          id: "demo-album-1",
          name: "Greatest Hits Collection",
          artist: "Various Artists",
          year: "2025",
          albumArt: "assets/new-default-album.png",
          source: "local"
        },
        {
          id: "demo-album-2",
          name: "Summer Vibes",
          artist: "Beach Band",
          year: "2025", 
          albumArt: "assets/new-default-album.png",
          source: "local"
        },
        {
          id: "demo-album-3",
          name: "Rock Anthems",
          artist: "Rock Legends",
          year: "2025",
          albumArt: "assets/new-default-album.png",
          source: "local"
        },
        {
          id: "demo-album-4",
          name: "Chill & Relax",
          artist: "Lo-fi Beats",
          year: "2025",
          albumArt: "assets/new-default-album.png",
          source: "local"
        }
      ];
    }
    
    // Shuffle the albums
    albums = this.shuffleArray(albums);
    
    // Return the requested number of albums
    return albums.slice(0, limit);
  }

  async getRandomPlaylists(limit = 4) {
    let playlists = [...this.playlists]; // Start with local playlists
    
    // If YouTube Music is initialized, get playlists from there
    if (this.isYoutubeMusicInitialized) {
      try {
        const ytPlaylists = await youtubeMusic.getPlaylists();
        if (ytPlaylists && ytPlaylists.length > 0) {
          // Format YouTube Music playlists to match our format
          const formattedYtPlaylists = ytPlaylists.map(playlist => ({
            id: `YT_${playlist.id}`, // Prefix with YT_ to distinguish
            name: playlist.name,
            thumbnail: playlist.thumbnail || "assets/new-default-playlist.png",
            tracks: [], // We'll load tracks when needed
            source: "youtube-music"
          }));
          
          playlists = [...playlists, ...formattedYtPlaylists];
        }
      } catch (error) {
        console.error("Error getting YouTube Music playlists:", error);
      }
    }
    
    // If we don't have enough playlists, add some demo playlists
    if (playlists.length < limit) {
      const demoPlaylists = [
        {
          id: "demo-playlist-1",
          name: "Workout Motivation",
          tracks: this.library.slice(0, 3).map(track => track.id),
          thumbnail: "assets/new-default-playlist.png",
          source: "local"
        },
        {
          id: "demo-playlist-2",
          name: "Relaxing Evening",
          tracks: this.library.slice(1, 4).map(track => track.id),
          thumbnail: "assets/new-default-playlist.png",
          source: "local"
        },
        {
          id: "demo-playlist-3",
          name: "Drive Mix",
          tracks: this.library.slice(0, 4).map(track => track.id),
          thumbnail: "assets/new-default-playlist.png",
          source: "local"
        },
        {
          id: "demo-playlist-4",
          name: "Party Hits",
          tracks: this.library.slice(2, 4).map(track => track.id),
          thumbnail: "assets/new-default-playlist.png",
          source: "local"
        }
      ];
      
      // Add the demo playlists
      playlists = [...playlists, ...demoPlaylists];
    }
    
    // Shuffle the playlists
    playlists = this.shuffleArray(playlists);
    
    // Return the requested number of playlists
    return playlists.slice(0, limit);
  }

  async getRandomArtists(limit = 6) {
    // Since we don't have a separate artists database, let's extract artists from tracks
    // and create artist objects
    let artists = [];
    
    // Get unique artists from local library
    const localArtists = [...new Set(this.library.map(track => track.artist))];
    localArtists.forEach(artistName => {
      artists.push({
        id: `local_artist_${artistName.replace(/\s+/g, '_')}`,
        name: artistName,
        image: "assets/new-default-album.png",
        source: "local"
      });
    });
    
    // If YouTube Music is initialized, try to get some artists from there
    if (this.isYoutubeMusicInitialized) {
      try {
        // Use different queries to get popular artists
        const queries = ["top artists", "popular artists", "trending artists"];
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        
        const results = await youtubeMusic.search(randomQuery, 15);
        
        // Extract unique artists from search results
        if (results && results.length > 0) {
          // Get a unique list of artists from the results
          const ytArtists = [];
          const artistNames = new Set();
          
          results.forEach(item => {
            if (item.artist && !artistNames.has(item.artist)) {
              artistNames.add(item.artist);
              ytArtists.push({
                id: `yt_artist_${item.artist.replace(/\s+/g, '_')}`,
                name: item.artist,
                image: item.albumArt || "assets/new-default-album.png",
                source: "youtube-music"
              });
            }
          });
          
          artists = [...artists, ...ytArtists];
        }
      } catch (error) {
        console.error("Error getting YouTube Music artists:", error);
      }
    }
    
    // If we still don't have enough artists, add some demo artists
    if (artists.length < limit) {
      const demoArtists = [
        {
          id: "demo-artist-1",
          name: "The Weeknd",
          image: "assets/new-default-album.png",
          source: "local"
        },
        {
          id: "demo-artist-2",
          name: "Taylor Swift",
          image: "assets/new-default-album.png",
          source: "local"
        },
        {
          id: "demo-artist-3",
          name: "Ed Sheeran",
          image: "assets/new-default-album.png",
          source: "local"
        },
        {
          id: "demo-artist-4",
          name: "Dua Lipa",
          image: "assets/new-default-album.png",
          source: "local"
        },
        {
          id: "demo-artist-5",
          name: "BTS",
          image: "assets/new-default-album.png",
          source: "local"
        },
        {
          id: "demo-artist-6",
          name: "Billie Eilish",
          image: "assets/new-default-album.png",
          source: "local"
        }
      ];
      
      // Add the demo artists
      artists = [...artists, ...demoArtists];
    }
    
    // Shuffle the artists
    artists = this.shuffleArray(artists);
    
    // Return the requested number of artists
    return artists.slice(0, limit);
  }

  // Helper method to shuffle an array
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

module.exports = new MusicPlayer();
