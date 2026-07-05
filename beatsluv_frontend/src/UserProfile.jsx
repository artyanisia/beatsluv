import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

function Icon({ name }) {
  const icons = {
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
    heart: (
      <path d="m19 14c0 5-7 7-7 7s-7-2-7-7a4.5 4.5 0 0 1 9 0c0-2.5 2-4.5 4.5-4.5S23 11.5 23 14Z" />
    ),
    star: (
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.86 1.18 6.87L12 17.77 5.82 21 7 14.13l-5-4.86 6.91-1.01L12 2Z" />
    ),
    message: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
    trend: (
      <>
        <polyline points="22,7 13.5,15.5 8.5,10.5 2,17" />
        <polyline points="16,7 22,7 22,13" />
      </>
    ),
    calendar: (
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="svg-icon">
      {icons[name]}
    </svg>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="profile-stat-card">
      <div className="profile-stat-icon">
        <Icon name={icon} />
      </div>
      <div>
        <div className="profile-stat-value">{value}</div>
        <div className="profile-stat-label">{label}</div>
      </div>
    </div>
  );
}

function FeedbackCard({ feedback, received = false }) {
  return (
    <div className="feedback-card">
      <div className="feedback-header">
        <strong>{feedback.rating || "Indisponibil"}/5</strong>
        <span>{feedback.created_at ? new Date(feedback.created_at).toLocaleDateString() : ""}</span>
      </div>
      <div className="feedback-track">
        {received ? "Pe piesa ta" : "Ai evaluat"}: {feedback.track_title || `Piesa #${feedback.track_id}`}
      </div>
      {feedback.comment && <p className="feedback-comment">{feedback.comment}</p>}
      <div className="feedback-meta">
        <span>{feedback.listen_count || 0} ascultari</span>
        {feedback.liked && <span>Apreciata</span>}
        {feedback.downloaded && <span>Descarcata</span>}
        {feedback.shared && <span>Distribuita</span>}
      </div>
    </div>
  );
}

const emptyStats = {
  tracks_generated: 0,
  feedback_given: 0,
  feedback_received: 0,
  avg_rating_received: 0,
  total_listens: 0,
  likes_received: 0,
  member_since: null,
  favorite_genre: null,
  favorite_mood: null,
};

const UserProfile = () => {
  const { user, getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(emptyStats);
  const [feedbackOferite, setFeedbackOferite] = useState([]);
  const [feedbackPrimite, setFeedbackPrimite] = useState([]);
  const [recentPiese, setRecentPiese] = useState([]);
  const [creatorAnalytics, setCreatorAnalytics] = useState({
    top_tracks: [],
    genre_performance: [],
    prompt_versions: 0,
    success_rate: 0,
  });
  const [activeTab, setActiveTab] = useState("received");

  useEffect(() => {
    if (user) {
      loadUserStats();
    }
  }, [user]);

  async function fetchJson(path, headers) {
    const response = await fetch(`${API_BASE_URL}${path}`, { headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.detail || `Nu s-au putut incarca datele pentru ${path}`);
    }
    return payload;
  }

  async function loadUserStats() {
    setLoading(true);
    setError("");

    try {
      const headers = {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      };

      const [statsData, givenData, receivedData, tracksData, analyticsData] = await Promise.all([
        fetchJson("/users/me/stats", headers),
        fetchJson("/users/me/feedback-given", headers),
        fetchJson("/users/me/feedback-received", headers),
        fetchJson("/tracks?limit=6", headers),
        fetchJson("/users/me/creator-analytics", headers),
      ]);

      setStats(statsData);
      setFeedbackOferite(givenData);
      setFeedbackPrimite(receivedData);
      setRecentPiese(tracksData);
      setCreatorAnalytics(analyticsData);
    } catch (err) {
      setError(err.message || "Nu s-au putut incarca datele profilului");
    } finally {
      setLoading(false);
    }
  }

  async function toggleTrackVizibilitate(trackId, isPublic) {
    try {
      const response = await fetch(`${API_BASE_URL}/tracks/${trackId}/visibility`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_public: isPublic }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || "Nu s-a putut actualiza vizibilitatea piesei");
      }

      setRecentPiese((current) =>
        current.map((track) => (track.id === trackId ? { ...track, is_public: isPublic } : track)),
      );
    } catch (err) {
      setError(err.message || "Nu s-a putut actualiza vizibilitatea piesei");
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div>Se incarca profilul...</div>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container glass-card">
        <h2>Eroare la incarcarea profilului</h2>
        <p>{error}</p>
        <button type="button" onClick={loadUserStats}>
          Reincearca
        </button>
      </div>
    );
  }

  const feedbackList = activeTab === "received" ? feedbackPrimite : feedbackOferite;

  return (
    <div className="user-profile">
      <section className="profile-hero-card">
        <div className="profile-avatar">
          <Icon name="user" />
        </div>
        <div className="profile-info">
          <h1 className="profile-name">{user.email}</h1>
          <p className="profile-title">Creator muzical</p>
          <div className="profile-meta-row">
            {stats.member_since && (
              <span>
                <Icon name="calendar" />
                Din {new Date(stats.member_since).toLocaleDateString()}
              </span>
            )}
            {stats.favorite_genre && <span>{stats.favorite_genre}</span>}
            {stats.favorite_mood && <span>{stats.favorite_mood}</span>}
          </div>
        </div>
      </section>

      <section className="profile-stats-grid">
        <StatCard label="Piese generate" value={stats.tracks_generated} icon="music" />
        <StatCard label="Feedback oferit" value={stats.feedback_given} icon="message" />
        <StatCard label="Feedback primit" value={stats.feedback_received} icon="heart" />
        <StatCard
          label="Rating mediu primit"
          value={stats.avg_rating_received ? `${stats.avg_rating_received}/5` : "Indisponibil"}
          icon="star"
        />
        <StatCard label="Ascultari totale" value={stats.total_listens} icon="trend" />
        <StatCard label="Aprecieri primite" value={stats.likes_received} icon="heart" />
        <StatCard label="Rata de succes" value={`${creatorAnalytics.success_rate || 0}%`} icon="trend" />
        <StatCard label="Versiuni prompt" value={creatorAnalytics.prompt_versions || 0} icon="message" />
      </section>

      <section className="profile-content-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Feedback</h3>
              <p className="card-subtitle">Recenzii oferite si primite</p>
            </div>
          </div>
          <div className="card-content">
            <div className="feedback-tabs">
              <button
                type="button"
                className={`tab-button ${activeTab === "received" ? "active" : ""}`}
                onClick={() => setActiveTab("received")}
              >
                Primite ({feedbackPrimite.length})
              </button>
              <button
                type="button"
                className={`tab-button ${activeTab === "given" ? "active" : ""}`}
                onClick={() => setActiveTab("given")}
              >
                Oferite ({feedbackOferite.length})
              </button>
            </div>

            <div className="feedback-list">
              {feedbackList.length ? (
                feedbackList.slice(0, 8).map((feedback) => (
                  <FeedbackCard key={feedback.id} feedback={feedback} received={activeTab === "received"} />
                ))
              ) : (
                <p className="empty-state">Nu exista feedback inca.</p>
              )}
            </div>
          </div>
        </div>

        <aside className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Piesele mele</h3>
              <p className="card-subtitle">Vizibilitate publica sau privata</p>
            </div>
          </div>
          <div className="card-content">
            {recentPiese.length ? (
              <div className="recent-tracks-list">
                {recentPiese.map((track) => (
                  <div key={track.id} className="recent-track-item">
                    <div className="track-info">
                      <h4 className="track-title">{track.title}</h4>
                      <div className="track-meta">
                        <span>{track.genre || "Indisponibil"}</span>
                        <span>{track.duration_seconds}s</span>
                      </div>
                    </div>
                    <div className="track-controls">
                      <label className="toggle-switch" aria-label={`Toggle visibility for ${track.title}`}>
                        <input
                          type="checkbox"
                          checked={track.is_public || false}
                          onChange={() => toggleTrackVizibilitate(track.id, !track.is_public)}
                        />
                        <span className="toggle-slider" />
                      </label>
                      <span className="toggle-label">{track.is_public ? "Public" : "Privat"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Nu ai piese inca.</p>
            )}
          </div>
        </aside>
      </section>

      <section className="profile-content-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Cele mai bune piese</h3>
              <p className="card-subtitle">Ordonate dupa rating, ascultari si reactii</p>
            </div>
          </div>
          <div className="card-content">
            {creatorAnalytics.top_tracks?.length ? (
              <div className="recent-tracks-list">
                {creatorAnalytics.top_tracks.map((track) => (
                  <div key={track.id} className="recent-track-item">
                    <div className="track-info">
                      <h4 className="track-title">{track.title}</h4>
                      <div className="track-meta">
                        <span>{track.genre || "Indisponibil"}</span>
                        <span>{track.mood || "Indisponibil"}</span>
                        <span>{track.avg_rating ? `${track.avg_rating}/5` : "Fara rating"}</span>
                        <span>{track.listens || 0} ascultari</span>
                      </div>
                    </div>
                    <span className="track-date">{track.feedback_count || 0} recenzii</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Nu exista piese evaluate inca.</p>
            )}
          </div>
        </div>

        <aside className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Performanta pe genuri</h3>
              <p className="card-subtitle">Unde raspunde cel mai bine audienta</p>
            </div>
          </div>
          <div className="card-content">
            {creatorAnalytics.genre_performance?.length ? (
              <div className="genre-ratings-list">
                {creatorAnalytics.genre_performance.map((genre) => (
                  <div key={genre.genre} className="genre-rating">
                    <div>
                      <strong className="genre-name">{genre.genre}</strong>
                      <span>{genre.track_count} piese / {genre.feedback_count} recenzii</span>
                    </div>
                    <strong>{genre.avg_rating ? `${genre.avg_rating}/5` : "Indisponibil"}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Nu exista inca statistici pe genuri.</p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
};

export default UserProfile;


