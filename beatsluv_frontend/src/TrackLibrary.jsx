import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

function Icon({ name }) {
  const icons = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    filter: (
      <>
        <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46" />
      </>
    ),
    heart: (
      <>
        <path d="m19,14c0,5-7,7-7,7s-7-2-7-7a4.5,4.5 0 0,1 9,0c0-2.5,2-4.5,4.5-4.5s4.5,2,4.5,4.5z" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7,10 12,15 17,10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </>
    ),
    close: (
      <>
        <path d="M18 6L6 18" />
        <path d="M6 6l12 12" />
      </>
    ),
    star: (
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.86 1.18 6.87L12 17.77 5.82 21 7 14.13l-5-4.86 6.91-1.01L12 2Z" />
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="svg-icon">
      {icons[name]}
    </svg>
  );
}

function buildAudioUrl(audioUrl) {
  if (!audioUrl) {
    return "";
  }

  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    return audioUrl;
  }

  return `${API_BASE_URL}${audioUrl}`;
}

function FeedbackModal({ track, isOpen, onClose, onSubmit }) {
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    comment: "",
    liked: true,
    downloaded: false,
    shared: false,
    listen_count: 1,
    sentiment_score: 0.8,
  });

  function updateFeedbackField(field, value) {
    setFeedbackForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(feedbackForm);
    setFeedbackForm((current) => ({ ...current, comment: "" }));
  }

  if (!isOpen || !track) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Give Feedback: {track.title}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-grid compact">
              <div className="form-group">
                <label htmlFor="rating">Rating (1-5)</label>
                <input
                  id="rating"
                  type="number"
                  min="1"
                  max="5"
                  value={feedbackForm.rating}
                  onChange={(event) => updateFeedbackField("rating", event.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="listen-count">Listen Count</label>
                <input
                  id="listen-count"
                  type="number"
                  min="0"
                  value={feedbackForm.listen_count}
                  onChange={(event) => updateFeedbackField("listen_count", event.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="feedback-comment">Comment</label>
              <textarea
                id="feedback-comment"
                rows="3"
                value={feedbackForm.comment}
                onChange={(event) => updateFeedbackField("comment", event.target.value)}
                placeholder="Share your thoughts about this track..."
              />
            </div>

            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={feedbackForm.liked}
                  onChange={(event) => updateFeedbackField("liked", event.target.checked)}
                />
                Liked
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={feedbackForm.downloaded}
                  onChange={(event) => updateFeedbackField("downloaded", event.target.checked)}
                />
                Downloaded
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={feedbackForm.shared}
                  onChange={(event) => updateFeedbackField("shared", event.target.checked)}
                />
                Shared
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit">Save Feedback</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const TrackLibrary = () => {
  const { getAuthHeaders } = useAuth();
  const [tracks, setTracks] = useState([]);
  const [filteredTracks, setFilteredTracks] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [message, setMessage] = useState("");
  const [appAlert, setAppAlert] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackTrack, setFeedbackTrack] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    genre: "",
    mood: "",
    sortBy: "created_at",
  });

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tracks, filters]);

  async function fetchTracks() {
    setIsLoadingTracks(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/tracks/public`, {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Could not load public tracks.");
      }

      const data = await response.json();
      setTracks(data);

      if (data.length === 0) {
        setSelectedTrack(null);
      } else if (!selectedTrack || !data.some((track) => track.id === selectedTrack.id)) {
        setSelectedTrack(data[0]);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoadingTracks(false);
    }
  }

  function applyFilters() {
    let filtered = [...tracks];

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(
        (track) =>
          track.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
          track.prompt?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Genre filter
    if (filters.genre) {
      filtered = filtered.filter((track) => track.genre === filters.genre);
    }

    // Mood filter
    if (filters.mood) {
      filtered = filtered.filter((track) => track.mood === filters.mood);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        case "duration":
          return (b.duration_seconds || 0) - (a.duration_seconds || 0);
        case "tempo":
          return (b.tempo || 0) - (a.tempo || 0);
        default: // created_at
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });

    setFilteredTracks(filtered);
  }

  function updateFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleFeedbackClick(track) {
    setFeedbackTrack(track);
    setShowFeedbackModal(true);
  }

  async function handleFeedbackSubmit(feedbackData) {
    if (!feedbackTrack) return;

    const payload = {
      ...feedbackData,
      rating: feedbackData.rating ? Number(feedbackData.rating) : null,
      listen_count: Number(feedbackData.listen_count),
      sentiment_score: feedbackData.sentiment_score ? Number(feedbackData.sentiment_score) : null,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/tracks/${feedbackTrack.id}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Feedback request failed.");
      }

      setAppAlert({
        title: "Feedback Saved",
        message: `Your feedback for "${feedbackTrack.title}" was saved.`,
      });
      setShowFeedbackModal(false);
      setFeedbackTrack(null);
    } catch (error) {
      setMessage(error.message);
    }
  }

  // Get unique values for filters
  const uniqueGenres = [...new Set(tracks.map((track) => track.genre).filter(Boolean))];
  const uniqueMoods = [...new Set(tracks.map((track) => track.mood).filter(Boolean))];
  return (
    <div className="track-library">
      {message && <div className="status-message">{message}</div>}
      {appAlert && (
        <div className="app-alert-overlay" role="dialog" aria-modal="true" aria-labelledby="library-alert-title">
          <div className="app-alert-card">
            <h3 id="library-alert-title">{appAlert.title}</h3>
            <p>{appAlert.message}</p>
            <button type="button" onClick={() => setAppAlert(null)}>
              OK
            </button>
          </div>
        </div>
      )}

      <div className="track-library-grid">
        <div className="track-library-main">
          {/* Filters */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Filters & Search</h3>
                <p className="card-subtitle">Find your perfect track</p>
              </div>
            </div>
            <div className="card-content">
              <div className="filters-layout">
                <div className="search-section">
                  <div className="form-group">
                    <label htmlFor="search">Search</label>
                    <div className="search-input-wrapper">
                      <Icon name="search" className="search-icon-input" />
                      <input
                        id="search"
                        value={filters.search}
                        onChange={(e) => updateFilter("search", e.target.value)}
                        placeholder="Search tracks by title or prompt..."
                        className="search-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="filters-columns">
                  <div className="form-group">
                    <label htmlFor="genre-filter">Genre</label>
                    <select
                      id="genre-filter"
                      value={filters.genre}
                      onChange={(e) => updateFilter("genre", e.target.value)}
                    >
                      <option value="">All Genres</option>
                      {uniqueGenres.map((genre) => (
                        <option key={genre} value={genre}>
                          {genre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="mood-filter">Mood</label>
                    <select
                      id="mood-filter"
                      value={filters.mood}
                      onChange={(e) => updateFilter("mood", e.target.value)}
                    >
                      <option value="">All Moods</option>
                      {uniqueMoods.map((mood) => (
                        <option key={mood} value={mood}>
                          {mood}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="sort-filter">Sort By</label>
                    <select
                      id="sort-filter"
                      value={filters.sortBy}
                      onChange={(e) => updateFilter("sortBy", e.target.value)}
                    >
                      <option value="created_at">Newest First</option>
                      <option value="title">Title</option>
                      <option value="duration">Duration</option>
                      <option value="tempo">Tempo</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Track Grid */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Public Tracks</h3>
                <p className="card-subtitle">
                  {filteredTracks.length} of {tracks.length} tracks
                </p>
              </div>
              <button type="button" onClick={fetchTracks} disabled={isLoadingTracks} className="btn-secondary">
                {isLoadingTracks ? "Loading..." : "Refresh"}
              </button>
            </div>
            <div className="card-content">
              {isLoadingTracks ? (
                <div className="loading-spinner">
                  <div className="spinner" />
                  <span>Loading tracks...</span>
                </div>
              ) : filteredTracks.length === 0 ? (
                <div className="empty-state">
                  <p>No tracks found matching your filters.</p>
                </div>
              ) : (
                <div className="tracks-grid">
                  {filteredTracks.map((track) => (
                    <div
                      key={track.id}
                      className={`track-card ${selectedTrack?.id === track.id ? "selected" : ""}`}
                      onClick={() => setSelectedTrack(track)}
                    >
                      <div className="track-header">
                        <h4 className="track-title">{track.title}</h4>
                      </div>
                      
                      <div className="track-meta">
                        <span>#{track.id}</span>
                        <span>{track.genre || "N/A"}</span>
                        <span>{track.mood || "N/A"}</span>
                        <span>{track.duration_seconds}s</span>
                        {track.tempo && <span>{track.tempo} BPM</span>}
                        <span className={`visibility-badge ${track.is_public ? 'public' : 'private'}`}>
                          {track.is_public ? "Public" : "Private"}
                        </span>
                      </div>

                      {track.prompt && (
                        <p className="track-prompt">{track.prompt.substring(0, 100)}...</p>
                      )}

                      {track.audio_url && (
                        <audio
                          controls
                          src={buildAudioUrl(track.audio_url)}
                          className="audio-player compact-track-audio"
                          onClick={(event) => event.stopPropagation()}
                        />
                      )}

                      <div className="track-actions">
                        <button
                          type="button"
                          className="btn-feedback"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFeedbackClick(track);
                          }}
                        >
                          <Icon name="heart" />
                          Give Feedback
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected Track Details */}
        {selectedTrack && (
          <div className="track-library-sidebar">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Track Details</h3>
                  <p className="card-subtitle">{selectedTrack.title}</p>
                </div>
              </div>
              <div className="card-content">
                <div className="track-detail-grid">
                  <div>
                    <span>ID</span>
                    <strong>#{selectedTrack.id}</strong>
                  </div>
                  <div>
                    <span>Genre</span>
                    <strong>{selectedTrack.genre || "N/A"}</strong>
                  </div>
                  <div>
                    <span>Mood</span>
                    <strong>{selectedTrack.mood || "N/A"}</strong>
                  </div>
                  <div>
                    <span>Duration</span>
                    <strong>{selectedTrack.duration_seconds}s</strong>
                  </div>
                  <div>
                    <span>Tempo</span>
                    <strong>{selectedTrack.tempo ? `${selectedTrack.tempo} BPM` : "N/A"}</strong>
                  </div>
                  <div>
                    <span>Created</span>
                    <strong>{new Date(selectedTrack.created_at).toLocaleDateString()}</strong>
                  </div>
                </div>

                {selectedTrack.prompt && (
                  <div className="form-group">
                    <label>Prompt</label>
                    <p className="prompt-preview">{selectedTrack.prompt}</p>
                  </div>
                )}

                {selectedTrack.audio_url && (
                  <div className="form-group">
                    <label>Audio</label>
                    <audio controls src={buildAudioUrl(selectedTrack.audio_url)} className="audio-player" />
                  </div>
                )}

                <button
                  type="button"
                  className="btn-primary full-width"
                  onClick={() => handleFeedbackClick(selectedTrack)}
                >
                  <Icon name="heart" />
                  Give Feedback
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <FeedbackModal
        track={feedbackTrack}
        isOpen={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false);
          setFeedbackTrack(null);
        }}
        onSubmit={handleFeedbackSubmit}
      />
    </div>
  );
};

export default TrackLibrary;
