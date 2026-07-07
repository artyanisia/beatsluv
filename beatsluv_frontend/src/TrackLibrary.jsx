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
    melody_rating: 5,
    originality_rating: 5,
    emotional_impact_rating: 5,
    commercial_potential_rating: 5,
    production_quality_rating: 5,
    comment: "",
    liked: true,
    downloaded: false,
    shared: false,
    listen_count: 1,
    sentiment_score: 0.8,
  });
  const feedbackCriterii = [
    ["melody_rating", "Melodie"],
    ["originality_rating", "Originalitate"],
    ["emotional_impact_rating", "Impact emotional"],
    ["commercial_potential_rating", "Potential comercial"],
    ["production_quality_rating", "Calitate productie"],
  ];

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
          <h3>Ofera feedback: {track.title}</h3>
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
                <label htmlFor="listen-count">Numar ascultari</label>
                <input
                  id="listen-count"
                  type="number"
                  min="0"
                  value={feedbackForm.listen_count}
                  onChange={(event) => updateFeedbackField("listen_count", event.target.value)}
                />
              </div>
            </div>

            <div className="structured-rating-grid">
              {feedbackCriterii.map(([field, label]) => (
                <div className="form-group" key={field}>
                  <label htmlFor={`modal-${field}`}>{label}</label>
                  <input
                    id={`modal-${field}`}
                    type="range"
                    min="1"
                    max="5"
                    value={feedbackForm[field]}
                    onChange={(event) => updateFeedbackField(field, event.target.value)}
                  />
                  <span className="rating-text">{feedbackForm[field]}/5</span>
                </div>
              ))}
            </div>

            <div className="form-group">
              <label htmlFor="feedback-comment">Comentariu</label>
              <textarea
                id="feedback-comment"
                rows="3"
                value={feedbackForm.comment}
                onChange={(event) => updateFeedbackField("comment", event.target.value)}
                placeholder="Scrie ce parere ai despre aceasta piesa..."
              />
            </div>

            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  checked={feedbackForm.liked}
                  onChange={(event) => updateFeedbackField("liked", event.target.checked)}
                />
                Apreciata
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={feedbackForm.downloaded}
                  onChange={(event) => updateFeedbackField("downloaded", event.target.checked)}
                />
                Descarcata
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={feedbackForm.shared}
                  onChange={(event) => updateFeedbackField("shared", event.target.checked)}
                />
                Distribuita
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-secondary">
                Anuleaza
              </button>
              <button type="submit">Salveaza feedback</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const TrackLibrary = () => {
  const { getAuthHeaders } = useAuth();
  const [tracks, setPiese] = useState([]);
  const [filteredPiese, setFilteredPiese] = useState([]);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [isLoadingPiese, setIsLoadingPiese] = useState(false);
  const [message, setMessage] = useState("");
  const [appAlert, setAppAlert] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackTrack, setFeedbackTrack] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    genre: "",
    mood: "",
    creator: "",
    minTempo: "",
    maxTempo: "",
    minRating: "",
    createdAfter: "",
    createdBefore: "",
    sortBy: "created_at",
  });

  useEffect(() => {
    fetchPiese();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tracks, filters]);

  async function fetchPiese() {
    setIsLoadingPiese(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/tracks/public`, {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Nu s-au putut incarca piesele publice.");
      }

      const data = await response.json();
      setPiese(data);

      if (data.length === 0) {
        setSelectedTrack(null);
      } else if (!selectedTrack || !data.some((track) => track.id === selectedTrack.id)) {
        setSelectedTrack(data[0]);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoadingPiese(false);
    }
  }

  function applyFilters() {
    let filtered = [...tracks];

    // Cauta filter
    if (filters.search) {
      filtered = filtered.filter(
        (track) =>
          track.title?.toLowerCase().includes(filters.search.toLowerCase()) ||
          track.prompt?.toLowerCase().includes(filters.search.toLowerCase()) ||
          track.creator_email?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Gen filter
    if (filters.genre) {
      filtered = filtered.filter((track) => track.genre === filters.genre);
    }

    // Sentiment filter
    if (filters.mood) {
      filtered = filtered.filter((track) => track.mood === filters.mood);
    }

    if (filters.creator) {
      filtered = filtered.filter((track) =>
        track.creator_email?.toLowerCase().includes(filters.creator.toLowerCase())
      );
    }

    if (filters.minTempo) {
      filtered = filtered.filter((track) => Number(track.tempo || 0) >= Number(filters.minTempo));
    }

    if (filters.maxTempo) {
      filtered = filtered.filter((track) => Number(track.tempo || 0) <= Number(filters.maxTempo));
    }

    if (filters.minRating) {
      filtered = filtered.filter((track) => Number(track.avg_rating || 0) >= Number(filters.minRating));
    }

    if (filters.createdAfter) {
      filtered = filtered.filter((track) => new Date(track.created_at) >= new Date(filters.createdAfter));
    }

    if (filters.createdBefore) {
      filtered = filtered.filter((track) => new Date(track.created_at) <= new Date(filters.createdBefore));
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
        case "rating":
          return (b.avg_rating || 0) - (a.avg_rating || 0);
        default: // created_at
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
    });

    setFilteredPiese(filtered);
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
      melody_rating: Number(feedbackData.melody_rating),
      originality_rating: Number(feedbackData.originality_rating),
      emotional_impact_rating: Number(feedbackData.emotional_impact_rating),
      commercial_potential_rating: Number(feedbackData.commercial_potential_rating),
      production_quality_rating: Number(feedbackData.production_quality_rating),
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
        throw new Error(data.detail || "Cererea de feedback a esuat.");
      }

      setAppAlert({
        title: "Feedback salvat",
        message: `Feedbackul pentru "${feedbackTrack.title}" a fost salvat.`,
      });
      setShowFeedbackModal(false);
      setFeedbackTrack(null);
    } catch (error) {
      setMessage(error.message);
    }
  }

  // Get unique values for filters
  const uniqueGens = [...new Set(tracks.map((track) => track.genre).filter(Boolean))];
  const uniqueSentimente = [...new Set(tracks.map((track) => track.mood).filter(Boolean))];
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
                <h3 className="card-title">Filtre si cautare</h3>
                <p className="card-subtitle">Gaseste piesa potrivita</p>
              </div>
            </div>
            <div className="card-content">
              <div className="filters-layout">
                <div className="search-section">
                  <div className="form-group">
                    <label htmlFor="search">Cautare</label>
                    <div className="search-input-wrapper">
                      <Icon name="search" className="search-icon-input" />
                      <input
                        id="search"
                        value={filters.search}
                        onChange={(e) => updateFilter("search", e.target.value)}
                        placeholder="Cauta piese dupa titlu sau prompt..."
                        className="search-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="filters-columns">
                  <div className="form-group">
                    <label htmlFor="genre-filter">Gen</label>
                    <select
                      id="genre-filter"
                      value={filters.genre}
                      onChange={(e) => updateFilter("genre", e.target.value)}
                    >
                      <option value="">Toate genurile</option>
                      {uniqueGens.map((genre) => (
                        <option key={genre} value={genre}>
                          {genre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="mood-filter">Sentiment</label>
                    <select
                      id="mood-filter"
                      value={filters.mood}
                      onChange={(e) => updateFilter("mood", e.target.value)}
                    >
                      <option value="">Toate sentimentele</option>
                      {uniqueSentimente.map((mood) => (
                        <option key={mood} value={mood}>
                          {mood}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="sort-filter">Sorteaza dupa</label>
                    <select
                      id="sort-filter"
                      value={filters.sortBy}
                      onChange={(e) => updateFilter("sortBy", e.target.value)}
                    >
                      <option value="created_at">Cele mai noi</option>
                      <option value="title">Titlu</option>
                      <option value="duration">Durata</option>
                      <option value="tempo">Tempo</option>
                      <option value="rating">Rating</option>
                    </select>
                  </div>
                </div>

                <div className="filters-columns advanced-filters">
                  <div className="form-group">
                    <label htmlFor="creator-filter">Creator</label>
                    <input
                      id="creator-filter"
                      value={filters.creator}
                      onChange={(e) => updateFilter("creator", e.target.value)}
                      placeholder="email creator"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="min-tempo">Min BPM</label>
                    <input
                      id="min-tempo"
                      type="number"
                      value={filters.minTempo}
                      onChange={(e) => updateFilter("minTempo", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="max-tempo">Max BPM</label>
                    <input
                      id="max-tempo"
                      type="number"
                      value={filters.maxTempo}
                      onChange={(e) => updateFilter("maxTempo", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="min-rating">Rating minim</label>
                    <input
                      id="min-rating"
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={filters.minRating}
                      onChange={(e) => updateFilter("minRating", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="created-after">Creat dupa</label>
                    <input
                      id="created-after"
                      type="date"
                      value={filters.createdAfter}
                      onChange={(e) => updateFilter("createdAfter", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="created-before">Creat inainte de</label>
                    <input
                      id="created-before"
                      type="date"
                      value={filters.createdBefore}
                      onChange={(e) => updateFilter("createdBefore", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Track Grid */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Piese publice</h3>
                <p className="card-subtitle">
                  {filteredPiese.length} din {tracks.length} piese
                </p>
              </div>
              <button type="button" onClick={fetchPiese} disabled={isLoadingPiese} className="btn-secondary">
                {isLoadingPiese ? "Se incarca..." : "Actualizeaza"}
              </button>
            </div>
            <div className="card-content">
              {isLoadingPiese ? (
                <div className="loading-spinner">
                  <div className="spinner" />
                  <span>Se incarca piesele...</span>
                </div>
              ) : filteredPiese.length === 0 ? (
                <div className="empty-state">
                  <p>Nu au fost gasite piese pentru filtrele alese.</p>
                </div>
              ) : (
                <div className="tracks-grid">
                  {filteredPiese.map((track) => (
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
                        <span>{track.genre || "Indisponibil"}</span>
                        <span>{track.mood || "Indisponibil"}</span>
                        <span>{track.duration_seconds}s</span>
                        {track.tempo && <span>{track.tempo} BPM</span>}
                        <span>{track.avg_rating ? `${track.avg_rating}/5` : "Fara rating"}</span>
                        {track.creator_email && <span>{track.creator_email}</span>}
                        <span className={`visibility-badge ${track.is_public ? 'public' : 'private'}`}>
                          {track.is_public ? "Public" : "Privat"}
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
                          Ofera feedback
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected Detalii piesa */}
        {selectedTrack && (
          <div className="track-library-sidebar">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Detalii piesa</h3>
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
                    <span>Gen</span>
                    <strong>{selectedTrack.genre || "Indisponibil"}</strong>
                  </div>
                  <div>
                    <span>Sentiment</span>
                    <strong>{selectedTrack.mood || "Indisponibil"}</strong>
                  </div>
                  <div>
                    <span>Durata</span>
                    <strong>{selectedTrack.duration_seconds}s</strong>
                  </div>
                  <div>
                    <span>Tempo</span>
                    <strong>{selectedTrack.tempo ? `${selectedTrack.tempo} BPM` : "Indisponibil"}</strong>
                  </div>
                  <div>
                    <span>Rating mediu</span>
                    <strong>{selectedTrack.avg_rating ? `${selectedTrack.avg_rating}/5` : "Indisponibil"}</strong>
                  </div>
                  <div>
                    <span>Feedback</span>
                    <strong>{selectedTrack.feedback_count || 0}</strong>
                  </div>
                  <div>
                    <span>Creator</span>
                    <strong>{selectedTrack.creator_email || "Indisponibil"}</strong>
                  </div>
                  <div>
                    <span>Creata</span>
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
                  Ofera feedback
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


