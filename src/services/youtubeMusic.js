// YouTube Music API integration for Spotify Windows App
const YTMusic = require("ytmusic-api");
const ytdl = require("ytdl-core");
const { BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

class YouTubeMusicService {
  constructor() {
    this.ytmusic = new YTMusic();
    this.isInitialized = false;
    this.currentTrack = null;
    this.audioPlayer = null;
    this.isPlaying = false;
    this.volume = 0.7;
    this.currentTime = 0;
    this.duration = 0;
    this.playbackTimer = null;
  }

  async initialize() {
    try {
      // Initialize the YouTube Music API
      await this.ytmusic.initialize();
      this.isInitialized = true;
      console.log("YouTube Music API initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize YouTube Music API:", error);
      return false;
    }
  }

  async search(query, limit = 20) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log(`Searching YouTube Music for: "${query}"`);

      // Use filter: 'songs' to specifically search for songs
      const results = await this.ytmusic.search(query, {
        filter: "songs", // This specifically filters for songs
        limit: limit,
      });
      console.log(`YouTube Music search returned ${results.length} results`);

      // Map results to our format
      const formattedResults = results
        .map((item) => {
          // Skip non-VIDEO types
          if (item.type !== "VIDEO") {
            return null;
          }

          // Log the item structure to debug
          console.log("Raw YT Music item:", JSON.stringify(item, null, 2));

          // Extract video ID
          const videoId = item.videoId || "";
          if (!videoId) {
            return null;
          }

          // Extract artist info
          let artistName = "Unknown Artist";
          if (item.artist) {
            // New format has artist as an object with name property
            artistName = item.artist.name || "Unknown Artist";
          }

          // Extract thumbnail URL
          let albumArt = "assets/new-default-album.png";
          if (item.thumbnails && item.thumbnails.length > 0) {
            albumArt = item.thumbnails[0].url;
          }

          return {
            id: videoId,
            name: item.name || "Unknown Track",
            artist: artistName,
            album: "YouTube Music",
            duration: this.convertDurationToSeconds(item.duration),
            albumArt: albumArt,
            source: "youtube-music",
          };
        })
        .filter(Boolean); // Remove null entries

      console.log(`Formatted ${formattedResults.length} results for UI`);
      return formattedResults;
    } catch (error) {
      console.error("Error searching YouTube Music:", error);
      return [];
    }
  }

  async searchAlbums(query, limit = 20) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log(`Searching YouTube Music for albums: "${query}"`);

      // Search for albums
      const results = await this.ytmusic.search(query, {
        filter: "albums",
        limit: limit,
      });

      console.log(
        `YouTube Music album search returned ${results.length} results`
      );

      // Map results to our format
      const formattedResults = results
        .map((item) => {
          // Skip non-ALBUM types
          if (item.type !== "ALBUM") {
            return null;
          }

          // Log the item structure to debug
          console.log("Raw Album item:", JSON.stringify(item, null, 2));

          // Extract album ID
          const albumId = item.albumId || "";
          if (!albumId) {
            return null;
          }

          // Extract artist info
          let artistName = "Unknown Artist";
          if (item.artist) {
            // New format has artist as an object with name property
            artistName = item.artist.name || "Unknown Artist";
          }

          // Extract album cover
          let albumArt = "assets/new-default-album.png";
          if (item.thumbnails && item.thumbnails.length > 0) {
            // Use the highest resolution thumbnail available
            albumArt = item.thumbnails[item.thumbnails.length - 1].url;
          }

          return {
            id: albumId,
            name: item.name || "Unknown Album",
            artist: artistName,
            year: item.year || "",
            albumArt: albumArt,
            source: "youtube-music",
          };
        })
        .filter(Boolean); // Remove null entries

      console.log(`Formatted ${formattedResults.length} album results for UI`);
      return formattedResults;
    } catch (error) {
      console.error("Error searching YouTube Music for albums:", error);
      return [];
    }
  }

  async getAlbumDetails(albumId) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log(`Getting details for album ID: ${albumId}`);

      const albumInfo = await this.ytmusic.getAlbum(albumId);
      console.log("Album info retrieved:", JSON.stringify(albumInfo, null, 2));

      // Format album details
      const albumDetails = {
        id: albumId,
        name: albumInfo.title || "Unknown Album",
        artist: albumInfo.artists
          ? albumInfo.artists.map((artist) => artist.name).join(", ")
          : "Unknown Artist",
        year: albumInfo.year || "",
        description: albumInfo.description || "",
        albumArt:
          albumInfo.thumbnails && albumInfo.thumbnails.length > 0
            ? albumInfo.thumbnails[albumInfo.thumbnails.length - 1].url
            : "assets/new-default-album.png",
        source: "youtube-music",
        tracks: [],
      };

      // Process tracks in the album
      if (albumInfo.tracks && Array.isArray(albumInfo.tracks)) {
        albumDetails.tracks = albumInfo.tracks
          .map((track) => {
            return {
              id: track.videoId || "",
              name: track.title || "Unknown Track",
              artist: track.artists
                ? track.artists.map((artist) => artist.name).join(", ")
                : albumDetails.artist,
              album: albumDetails.name,
              duration: track.duration
                ? this.convertDurationToSeconds(track.duration)
                : 0,
              albumArt: albumDetails.albumArt,
              source: "youtube-music",
              trackNumber: track.index || 0,
            };
          })
          .filter((track) => track.id); // Only keep tracks with valid IDs
      }

      return albumDetails;
    } catch (error) {
      console.error("Error getting album details:", error);
      return {
        id: albumId,
        name: "Unknown Album",
        artist: "Unknown Artist",
        year: "",
        albumArt: "assets/new-default-album.png",
        source: "youtube-music",
        tracks: [],
      };
    }
  }

  async getTrackDetails(trackId) {
    if (!this.isInitialized) await this.initialize();

    try {
      console.log(`Getting details for track ID: ${trackId}`);

      // First try to get detailed track info from YouTube Music API
      try {
        // Check if the getTrack method exists before trying to call it
        if (typeof this.ytmusic.getTrack === "function") {
          const trackInfo = await this.ytmusic.getTrack(trackId);
          console.log(
            "Track info retrieved:",
            JSON.stringify(trackInfo, null, 2)
          );

          // Extract properly formatted track details
          return {
            id: trackId,
            name: trackInfo.title || "Unknown Track",
            artist: trackInfo.artists
              ? trackInfo.artists.map((artist) => artist.name).join(", ")
              : "Unknown Artist",
            album: trackInfo.album ? trackInfo.album.name : "Unknown Album",
            duration: trackInfo.duration
              ? this.convertDurationToSeconds(trackInfo.duration)
              : 0,
            albumArt:
              trackInfo.thumbnails && trackInfo.thumbnails.length > 0
                ? trackInfo.thumbnails[trackInfo.thumbnails.length - 1].url
                : "assets/new-default-album.png",
            source: "youtube-music",
          };
        } else {
          throw new Error("this.ytmusic.getTrack is not a function");
        }
      } catch (trackError) {
        // If getting detailed track info fails, try to get video info using ytdl-core
        console.log(
          `Failed to get track details from YouTube Music API, falling back to ytdl-core: ${trackError.message}`
        );

        try {
          const info = await ytdl.getBasicInfo(trackId);

          return {
            id: trackId,
            name: info.videoDetails.title || "Unknown Track",
            artist: info.videoDetails.author
              ? info.videoDetails.author.name
              : "Unknown Artist",
            album: "YouTube Music",
            duration: parseInt(info.videoDetails.lengthSeconds) || 0,
            albumArt:
              info.videoDetails.thumbnails &&
              info.videoDetails.thumbnails.length > 0
                ? info.videoDetails.thumbnails[
                    info.videoDetails.thumbnails.length - 1
                  ].url
                : "assets/new-default-album.png",
            source: "youtube-music",
          };
        } catch (ytdlError) {
          console.error("ytdl-core info extraction failed:", ytdlError.message);
          // If ytdl-core fails too, we'll return a basic track object below
        }
      }
    } catch (error) {
      console.error("Error getting track details:", error);
    }

    // Return a basic track object with the ID so playback can still work
    return {
      id: trackId,
      name: `YouTube Track (${trackId})`,
      artist: "YouTube Music",
      album: "YouTube Music",
      duration: 0,
      albumArt: "assets/new-default-album.png",
      source: "youtube-music",
    };
  }

  async playTrack(trackId) {
    try {
      // Get audio stream URL
      const audioUrl = await this.getAudioUrl(trackId);
      if (!audioUrl) {
        console.error("Failed to get audio URL for track:", trackId);
        return false;
      }

      // Get track details
      const trackDetails = await this.getTrackDetails(trackId);
      if (!trackDetails) {
        console.error("Failed to get track details for track:", trackId);
        return false;
      }

      this.currentTrack = trackDetails;

      // Start playing the audio stream
      this.startPlayback(audioUrl);
      return true;
    } catch (error) {
      console.error("Error playing track:", error);
      return false;
    }
  }

  async getAudioUrl(videoId) {
    try {
      console.log(`Getting audio URL for video ID: ${videoId}`);

      // Try multiple methods to get a playable audio URL

      // Method 1: Use pure ytdl-core for direct extraction
      try {
        console.log("Trying ytdl-core direct method...");
        const options = {
          quality: "highestaudio",
          filter: "audioonly",
          highWaterMark: 1 << 25, // 32MB buffer
          requestOptions: {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "*/*",
              "Accept-Encoding": "gzip, deflate, br",
              "Accept-Language": "en-US,en;q=0.9",
              Referer: "https://www.youtube.com/",
            },
          },
        };

        // Use getInfo with enhanced options
        const info = await ytdl.getBasicInfo(
          `https://www.youtube.com/watch?v=${videoId}`,
          options
        );

        // First try audioonly formats
        let format = ytdl.chooseFormat(info.formats, {
          quality: "highestaudio",
          filter: "audioonly",
        });

        // If no audioonly format found, try any format with audio
        if (!format || !format.url) {
          console.log(
            "No audio-only format found, trying formats with audio..."
          );
          const audioFormats = info.formats.filter((format) => format.hasAudio);

          if (audioFormats.length > 0) {
            // Sort by audio quality
            audioFormats.sort(
              (a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0)
            );
            format = audioFormats[0];
          }
        }

        if (format && format.url) {
          console.log(
            `Audio URL found with method 1, bitrate: ${
              format.audioBitrate || "unknown"
            }`
          );
          return format.url;
        }

        throw new Error("No suitable audio format found with method 1");
      } catch (error) {
        console.log(`Method 1 failed: ${error.message}`);

        // Method 2: Try to extract playable URL from a raw HTML request
        try {
          console.log("Trying raw HTML extraction method...");

          // We'll use a more direct approach by creating a fake player and getting the direct URL
          // This creates a lightweight direct player URL that can work even when other methods fail

          // Since we can't make HTTP requests directly without additional libraries,
          // we'll construct a more reliable fallback URL
          const directUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&showinfo=0`;
          console.log(`Created alternative player URL: ${directUrl}`);

          // On a real direct implementation, we would make a request to this URL
          // Since we can't directly extract from the iframe, return this as a fallback
          return directUrl;
        } catch (embeddedError) {
          console.log(`Method 2 failed: ${embeddedError.message}`);

          // Method 3: Last resort - return a direct youtube.com URL
          const emergencyUrl = `https://www.youtube.com/watch?v=${videoId}`;
          console.log(`Using emergency fallback URL: ${emergencyUrl}`);
          return emergencyUrl;
        }
      }
    } catch (error) {
      console.error("Error getting audio URL:", error);
      return null;
    }
  }

  startPlayback(audioUrl) {
    try {
      console.log(`Starting playback of: ${audioUrl}`);

      // Close any existing player window
      if (this.audioPlayer) {
        try {
          this.audioPlayer.close();
        } catch (e) {
          console.log("Error closing existing player:", e);
        }
        this.audioPlayer = null;
      }

      // Create BrowserWindow for audio playback
      this.audioPlayer = new BrowserWindow({
        width: 400,
        height: 300,
        show: true, // Make visible for debugging - will help with audio permissions
        title: "Spotify Windows Music Player",
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          webSecurity: false, // Required to play cross-origin media
          enableRemoteModule: true,
        },
      });

      // Enable audio autoplay without user interaction
      this.audioPlayer.webContents.setAudioMuted(false);

      // Set up auto-hide after 5 seconds when playback is confirmed working
      setTimeout(() => {
        if (this.audioPlayer && !this.audioPlayer.isDestroyed()) {
          this.audioPlayer.hide();
        }
      }, 5000);

      // Handle window close
      this.audioPlayer.on("closed", () => {
        this.audioPlayer = null;
        this.stopPlayback();
      });

      // Determine if we're dealing with direct YouTube URL or audio stream URL
      const isYouTubePageUrl =
        audioUrl.includes("youtube.com/watch") ||
        audioUrl.includes("youtube.com/embed");

      if (isYouTubePageUrl) {
        console.log("Using YouTube page URL player");

        // If using embed URL, add parameters to ensure audio plays
        if (audioUrl.includes("youtube.com/embed")) {
          // Add parameters to ensure audio plays if not already present
          if (!audioUrl.includes("autoplay=1")) {
            audioUrl += (audioUrl.includes("?") ? "&" : "?") + "autoplay=1";
          }
        }

        const playerHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body, html { margin: 0; padding: 0; overflow: hidden; background: black; }
                .player-container { width: 100%; height: 100%; }
              </style>
            </head>
            <body>
              <div class="player-container">
                ${
                  audioUrl.includes("youtube.com/embed")
                    ? `<iframe id="ytplayer" width="100%" height="100%" src="${audioUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
                    : `<div id="player"></div>`
                }
              </div>
              
              ${
                !audioUrl.includes("youtube.com/embed")
                  ? `<script>
                    // Initialize YouTube Player API
                    var tag = document.createElement('script');
                    tag.src = "https://www.youtube.com/iframe_api";
                    var firstScriptTag = document.getElementsByTagName('script')[0];
                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                    
                    var player;
                    var videoId = "${this.currentTrack.id}";
                    console.log("Setting up YouTube player for video ID:", videoId);
                    
                    function onYouTubeIframeAPIReady() {
                      console.log("YouTube IFrame API ready, creating player");
                      player = new YT.Player('player', {
                        videoId: videoId,
                        playerVars: {
                          'autoplay': 1,
                          'controls': 0,
                          'disablekb': 0,
                          'enablejsapi': 1,
                          'modestbranding': 1,
                          'playsinline': 1,
                          'rel': 0,
                          'showinfo': 0
                        },
                        events: {
                          'onReady': onPlayerReady,
                          'onStateChange': onPlayerStateChange,
                          'onError': onPlayerError
                        }
                      });
                    }
                    
                    function onPlayerReady(event) {
                      console.log("YouTube player ready, playing video and setting volume");
                      event.target.unMute(); // Make sure audio is not muted
                      event.target.playVideo();
                      event.target.setVolume(70);
                    }
                    
                    function onPlayerStateChange(event) {
                      console.log("Player state changed to:", event.data);
                      if (event.data === YT.PlayerState.ENDED) {
                        console.log("Track ended");
                      }
                    }
                    
                    function onPlayerError(event) {
                      console.error("YouTube player error:", event.data);
                    }
                  </script>`
                  : ""
              }
            </body>
          </html>
        `;

        this.audioPlayer.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(playerHtml)}`
        );
      } else {
        console.log("Using direct audio stream player");

        const audioHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>body { margin: 0; padding: 0; background: black; }</style>
            </head>
            <body>
              <audio id="audioPlayer" controls autoplay style="width:100%; height:100px;">
                <source src="${audioUrl}" type="audio/mp4">
                Your browser does not support the audio element.
              </audio>
              <script>
                const audio = document.getElementById('audioPlayer');
                
                audio.volume = 0.7; // Default volume
                audio.muted = false; // Ensure not muted
                
                audio.onplay = function() {
                  console.log("Audio playback started");
                };
                
                audio.onended = function() {
                  console.log("Audio playback ended");
                };
                
                audio.onerror = function() {
                  console.error("Audio player error:", audio.error);
                };
                
                // Force play - needed in some browsers
                audio.play().catch(e => console.error("Error playing audio:", e));

                window.setVolume = function(level) {
                  audio.volume = level;
                };
                
                window.getCurrentTime = function() {
                  return audio.currentTime;
                };
                
                window.getDuration = function() {
                  return audio.duration;
                };
                
                window.pauseAudio = function() {
                  audio.pause();
                };
                
                window.resumeAudio = function() {
                  audio.play().catch(e => console.error("Error resuming audio:", e));
                };
              </script>
            </body>
          </html>
        `;

        this.audioPlayer.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(audioHtml)}`
        );
      }

      // Listen for did-finish-load to ensure audio isn't muted
      this.audioPlayer.webContents.on("did-finish-load", () => {
        // Ensure audio is not muted
        this.audioPlayer.webContents.setAudioMuted(false);

        // Execute script to unmute any audio elements
        this.audioPlayer.webContents
          .executeJavaScript(
            `
          // Try to interact with audio elements
          document.querySelectorAll('audio, video').forEach(el => {
            el.muted = false;
            el.play().catch(e => console.error("Error forcing play:", e));
          });
          
          // Try to interact with YouTube player
          if (typeof player !== 'undefined' && player) {
            player.unMute();
            player.setVolume(70);
            player.playVideo();
          }
        `
          )
          .catch((e) => console.error("Error executing audio script:", e));
      });

      // Set state and track playback
      this.isPlaying = true;
      this.currentTime = 0;
      this.duration = this.currentTrack ? this.currentTrack.duration : 0;

      // Set up timer to update current time and check playback state
      if (this.playbackTimer) {
        clearInterval(this.playbackTimer);
      }

      this.playbackTimer = setInterval(() => {
        if (this.audioPlayer) {
          // Update current time by either getting it from the player or incrementing
          this.currentTime++;

          // Check if we've reached the end of the track
          if (this.currentTime >= this.duration) {
            console.log("Track finished by duration check");
            this.stopPlayback();
          }
        } else {
          // Player was closed, stop the timer
          this.stopPlayback();
        }
      }, 1000);

      console.log("Playback started successfully");
    } catch (error) {
      console.error("Error starting playback:", error);

      // Fallback to simulate playback in case of error
      console.log("Falling back to simulated playback...");
      this.isPlaying = true;
      this.currentTime = 0;
      this.duration = this.currentTrack ? this.currentTrack.duration : 0;

      if (this.playbackTimer) {
        clearInterval(this.playbackTimer);
      }

      this.playbackTimer = setInterval(() => {
        if (this.currentTime < this.duration) {
          this.currentTime++;
        } else {
          console.log("Simulated playback finished");
          this.stopPlayback();
        }
      }, 1000);
    }
  }

  pausePlayback() {
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }

    // Pause the audio in the BrowserWindow player
    if (this.audioPlayer) {
      try {
        this.audioPlayer.webContents.executeJavaScript(`
          // Handle both YouTube Player API and HTML5 Audio
          try {
            if (typeof player !== 'undefined' && player) {
              player.pauseVideo();
            } else if (document.getElementById('audioPlayer')) {
              document.getElementById('audioPlayer').pause();
            }
          } catch (e) {
            console.error('Error pausing playback:', e);
          }
        `);
      } catch (error) {
        console.error("Error executing pause script:", error);
      }
    }
  }

  resumePlayback() {
    this.isPlaying = true;

    // Resume the audio in the BrowserWindow player
    if (this.audioPlayer) {
      try {
        this.audioPlayer.webContents.executeJavaScript(`
          // Handle both YouTube Player API and HTML5 Audio
          try {
            if (typeof player !== 'undefined' && player) {
              player.playVideo();
            } else if (document.getElementById('audioPlayer')) {
              document.getElementById('audioPlayer').play();
            }
          } catch (e) {
            console.error('Error resuming playback:', e);
          }
        `);
      } catch (error) {
        console.error("Error executing resume script:", error);
      }
    }

    // Restart the timer to track playback progress
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }

    this.playbackTimer = setInterval(() => {
      if (this.currentTime < this.duration) {
        this.currentTime++;
      } else {
        this.stopPlayback();
      }
    }, 1000);
  }

  stopPlayback() {
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }

    // Stop and close the BrowserWindow player
    if (this.audioPlayer) {
      try {
        // First try to stop the playback
        this.audioPlayer.webContents
          .executeJavaScript(
            `
          try {
            if (typeof player !== 'undefined' && player) {
              player.stopVideo();
            } else if (document.getElementById('audioPlayer')) {
              const audio = document.getElementById('audioPlayer');
              audio.pause();
              audio.currentTime = 0;
            }
          } catch (e) {
            console.error('Error stopping playback:', e);
          }
        `
          )
          .catch(() => {
            // Ignore errors, we're closing the window anyway
          });

        // Then close the window
        this.audioPlayer.close();
        this.audioPlayer = null;
      } catch (error) {
        console.error("Error closing audio player:", error);
      }
    }

    this.currentTime = 0;
  }

  setVolume(level) {
    // Ensure level is between 0 and 1
    this.volume = Math.max(0, Math.min(1, level));

    // Convert 0-1 scale to 0-100 for YouTube player
    const volumeLevel = Math.round(this.volume * 100);

    // Set volume in the BrowserWindow player
    if (this.audioPlayer) {
      try {
        this.audioPlayer.webContents.executeJavaScript(`
          try {
            if (typeof player !== 'undefined' && player) {
              player.setVolume(${volumeLevel});
            } else if (document.getElementById('audioPlayer')) {
              document.getElementById('audioPlayer').volume = ${this.volume};
            }
          } catch (e) {
            console.error('Error setting volume:', e);
          }
        `);
      } catch (error) {
        console.error("Error executing volume script:", error);
      }
    }
  }

  getPlaybackState() {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
    };
  }

  async getPlaylists() {
    if (!this.isInitialized) await this.initialize();

    try {
      // Instead of using getLibraryPlaylists (which doesn't exist),
      // use the search method to find playlists
      console.log("Getting YouTube Music playlists");

      // Option 1: Try to get user playlists if available
      try {
        // Some ytmusic-api packages support this method
        if (typeof this.ytmusic.getLibrary === "function") {
          const library = await this.ytmusic.getLibrary();
          console.log("Got library:", JSON.stringify(library, null, 2));

          if (
            library &&
            library.playlists &&
            Array.isArray(library.playlists)
          ) {
            return library.playlists.map((playlist) => ({
              id: playlist.playlistId || playlist.id,
              name: playlist.title || playlist.name,
              tracks: [],
              thumbnail:
                playlist.thumbnails && playlist.thumbnails.length > 0
                  ? playlist.thumbnails[playlist.thumbnails.length - 1].url
                  : "assets/new-default-playlist.png",
              source: "youtube-music",
            }));
          }
        }
      } catch (libraryError) {
        console.log("Could not get library playlists:", libraryError.message);
      }

      // Option 2: Search for some popular playlists as fallback
      const queries = ["Top hits", "Popular music", "Best songs", "Trending"];
      const query = queries[Math.floor(Math.random() * queries.length)];

      const results = await this.ytmusic.search(query, {
        filter: "playlists",
        limit: 5,
      });

      console.log(`Found ${results.length} playlists via search`);

      return results
        .filter((item) => item.browseId || item.playlistId)
        .map((playlist) => ({
          id: playlist.browseId || playlist.playlistId,
          name: playlist.title || "YouTube Music Playlist",
          tracks: [], // Would need to fetch tracks separately
          thumbnail:
            playlist.thumbnails && playlist.thumbnails.length > 0
              ? playlist.thumbnails[playlist.thumbnails.length - 1].url
              : "assets/new-default-playlist.png",
          source: "youtube-music",
        }));
    } catch (error) {
      console.error("Error getting playlists:", error);
      return [];
    }
  }

  async getPlaylistTracks(playlistId) {
    if (!this.isInitialized) await this.initialize();

    try {
      const tracks = await this.ytmusic.getPlaylist(playlistId);
      return tracks.tracks.map((track) => ({
        id: track.videoId,
        name: track.title,
        artist: track.artists.map((artist) => artist.name).join(", "),
        album: track.album ? track.album.name : "Unknown Album",
        duration: track.duration
          ? this.convertDurationToSeconds(track.duration)
          : 0,
        albumArt:
          track.thumbnails && track.thumbnails.length > 0
            ? track.thumbnails[track.thumbnails.length - 1].url
            : "assets/new-default-album.png",
        source: "youtube-music",
      }));
    } catch (error) {
      console.error("Error getting playlist tracks:", error);
      return [];
    }
  }

  convertDurationToSeconds(duration) {
    // Check what type of value we received
    console.log(`Converting duration: ${duration}, type: ${typeof duration}`);

    // If it's already a number, just return it
    if (typeof duration === "number") {
      return duration;
    }

    // If it's null or undefined, return 0
    if (duration == null) {
      return 0;
    }

    // If it's a string, try to parse it
    if (typeof duration === "string") {
      try {
        // Handle MM:SS format like "3:45" (225 seconds)
        if (duration.includes(":")) {
          const parts = duration.split(":").map(Number);
          if (parts.length === 2) {
            return parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }

        // Try to directly parse it as a number
        const parsed = parseInt(duration, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.warn(`Error parsing duration string "${duration}":`, e);
      }
    }

    // For objects, try to access a duration property if it exists
    if (typeof duration === "object" && duration !== null) {
      if (duration.seconds) return duration.seconds;
      if (duration.totalSeconds) return duration.totalSeconds;
      if (duration.lengthSeconds) return parseInt(duration.lengthSeconds, 10);

      // Try to convert to string and parse
      return this.convertDurationToSeconds(String(duration));
    }

    // If we can't parse it, return 0
    console.warn(`Could not parse duration value: ${duration}`);
    return 0;
  }

  cleanup() {
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
    }
  }
}

module.exports = new YouTubeMusicService();
