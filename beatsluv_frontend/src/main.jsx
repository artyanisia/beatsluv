import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AuthProvider, useAuth } from "./AuthContext";
import AuthForm from "./AuthForm";
import Dashboard from "./Dashboard";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function buildAudioUrl(audioUrl) {
  if (!audioUrl) {
    return "";
  }

  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    return audioUrl;
  }

  return `${API_BASE_URL}${audioUrl}`;
}

function AppContent() {
  const { user, logout, getAuthHeaders, loading } = useAuth();
  
  // Debug logging
  console.log('AppContent render - user:', user, 'loading:', loading);
  
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [feedbackList, setFeedbackList] = useState([]);
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  
  // Navigation state
  const [currentView, setCurrentView] = useState('generator'); // 'generator' or 'dashboard'

  const [generationForm, setGenerationForm] = useState({
    prompt: "Create a dreamy pop beat with soft vocals",
    genre: "pop",
    mood: "dreamy",
    tempo: 100,
    duration_seconds: 30,
  });

  const [feedbackForm, setFeedbackForm] = useState({
    rating: 5,
    comment: "",
    liked: true,
    downloaded: false,
    shared: false,
    listen_count: 1,
    sentiment_score: 0.8,
  });

  // All hooks must be called before any early returns
  const selectedTrack = useMemo(
    () => tracks.find((track) => String(track.id) === String(selectedTrackId)),
    [tracks, selectedTrackId],
  );

  async function fetchTracks() {
    setIsLoadingTracks(true);
    setMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/tracks`, {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Could not load tracks.");
      }

      const data = await response.json();
      setTracks(data);

      if (data.length > 0 && !selectedTrackId) {
        setSelectedTrackId(String(data[0].id));
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoadingTracks(false);
    }
  }

  async function fetchFeedback(trackId) {
    if (!trackId) {
      setFeedbackList([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/tracks/${trackId}/feedback`, {
        headers: {
          ...getAuthHeaders(),
        },
      });
      if (!response.ok) {
        throw new Error("Could not load feedback.");
      }

      setFeedbackList(await response.json());
    } catch (error) {
      setMessage(error.message);
    }
  }

  // All hooks must be called before any early returns
  useEffect(() => {
    if (user) {
      fetchTracks();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedTrackId) {
      fetchFeedback(selectedTrackId);
    }
  }, [selectedTrackId, user]);

  // Early returns after all hooks
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div>Loading BeatsLuv...</div>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  function updateGenerationField(field, value) {
    setGenerationForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateFeedbackField(field, value) {
    setFeedbackForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setIsGenerating(true);
    setMessage("Generating track...");

    const payload = {
      ...generationForm,
      tempo: generationForm.tempo ? Number(generationForm.tempo) : null,
      duration_seconds: Number(generationForm.duration_seconds),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/generation-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Couldn't generate");
      }

      setMessage(`Created track #${data.id}: ${data.title}`);
      await fetchTracks();
      setSelectedTrackId(String(data.id));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleFeedbackSubmit(event) {
    event.preventDefault();

    if (!selectedTrackId) {
      setMessage("Select a track first.");
      return;
    }

    const payload = {
      ...feedbackForm,
      rating: feedbackForm.rating ? Number(feedbackForm.rating) : null,
      listen_count: Number(feedbackForm.listen_count),
      sentiment_score: feedbackForm.sentiment_score
        ? Number(feedbackForm.sentiment_score)
        : null,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/tracks/${selectedTrackId}/feedback`, {
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

      setMessage(`Saved feedback #${data.id}.`);
      setFeedbackForm((current) => ({ ...current, comment: "" }));
      await fetchFeedback(selectedTrackId);
    } catch (error) {
      setMessage(error.message);
    }
  }


  return (
    <main className="app-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">BeatsLuv</p>
          <h1>{currentView === 'dashboard' ? 'Analytics Dashboard' : 'Music Generator'}</h1>
        </div>
        <div className="nav-actions">
          <button 
            type="button" 
            onClick={() => setCurrentView('generator')}
            className={currentView === 'generator' ? 'nav-button active' : 'nav-button'}
          >
            Generator
          </button>
          <button 
            type="button" 
            onClick={() => setCurrentView('dashboard')}
            className={currentView === 'dashboard' ? 'nav-button active' : 'nav-button'}
          >
            Dashboard
          </button>
        </div>
        <div className="user-actions">
          <span className="user-info">Welcome, {user.email}</span>
          {currentView === 'generator' && (
            <button type="button" onClick={fetchTracks} disabled={isLoadingTracks}>
              {isLoadingTracks ? "Loading..." : "Refresh"}
            </button>
          )}
          <button type="button" onClick={logout} className="logout-button">
            Logout
          </button>
        </div>
      </section>

      {message && <div className="status-message">{message}</div>}
      
      {/* Conditional rendering based on current view */}
      {currentView === 'dashboard' ? (
        <Dashboard />
      ) : (
        <>
          <section className="layout">
            <form className="panel" onSubmit={handleGenerate}>
              <div className="panel-heading">
                <h2>Generate Music</h2>
                <span>ACE-Step</span>
              </div>

              <label>
                Prompt
                <textarea
                  rows="4"
                  value={generationForm.prompt}
                  onChange={(event) => updateGenerationField("prompt", event.target.value)}
                />
              </label>

              <div className="form-grid">
                <label>
                  Genre
                  <input
                    value={generationForm.genre}
                    onChange={(event) => updateGenerationField("genre", event.target.value)}
                  />
                </label>

                <label>
                  Mood
                  <input
                    value={generationForm.mood}
                    onChange={(event) => updateGenerationField("mood", event.target.value)}
                  />
                </label>

                <label>
                  Tempo
                  <input
                    type="number"
                    value={generationForm.tempo}
                    onChange={(event) => updateGenerationField("tempo", event.target.value)}
                  />
                </label>

                <label>
                  Duration
                  <input
                    type="number"
                    min="1"
                    value={generationForm.duration_seconds}
                    onChange={(event) =>
                      updateGenerationField("duration_seconds", event.target.value)
                    }
                  />
                </label>
              </div>

              <button type="submit" disabled={isGenerating}>
                {isGenerating ? "Generating..." : "Generate Track"}
              </button>
            </form>

            <section className="panel">
              <div className="panel-heading">
                <h2>Tracks</h2>
                <span>Library</span>
              </div>

              <div className="track-list">
                {tracks.length === 0 && <p className="empty-state">No tracks yet.</p>}

                {tracks.map((track) => (
                  <button
                    type="button"
                    className={String(track.id) === String(selectedTrackId) ? "track active" : "track"}
                    key={track.id}
                    onClick={() => setSelectedTrackId(String(track.id))}
                  >
                    <strong>{track.title}</strong>
                    <span>
                      {track.artist ? `${track.artist} - ` : ""}#{track.id} - {track.status}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </section>

          <section className="layout lower-layout">
            <section className="panel">
              <div className="panel-heading">
                <h2>Selected Track</h2>
                <span>Preview</span>
              </div>

              {!selectedTrack && <p className="empty-state">Select a track to inspect it.</p>}

              {selectedTrack && (
                <div className="track-details">
                  <dl>
                    <div>
                      <dt>ID</dt>
                      <dd>{selectedTrack.id}</dd>
                    </div>
                    <div>
                      <dt>Title</dt>
                      <dd>{selectedTrack.title}</dd>
                    </div>
                    <div>
                      <dt>Artist</dt>
                      <dd>{selectedTrack.artist || "N/A"}</dd>
                    </div>
                    <div>
                      <dt>Album</dt>
                      <dd>{selectedTrack.album || "N/A"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{selectedTrack.status}</dd>
                    </div>
                    <div>
                      <dt>Duration</dt>
                      <dd>{selectedTrack.duration_seconds}s</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{selectedTrack.source || "ACE-Step"}</dd>
                    </div>
                    <div>
                      <dt>Genre</dt>
                      <dd>{selectedTrack.genre || "N/A"}</dd>
                    </div>
                  </dl>

                  <audio controls src={buildAudioUrl(selectedTrack.audio_url)} />
                  <a href={buildAudioUrl(selectedTrack.audio_url)} target="_blank" rel="noreferrer">
                    Open audio URL
                  </a>
                  {selectedTrack.external_url && (
                    <a href={selectedTrack.external_url} target="_blank" rel="noreferrer">
                      Open MusicBrainz page
                    </a>
                  )}
                </div>
              )}
            </section>

            <form className="panel" onSubmit={handleFeedbackSubmit}>
              <div className="panel-heading">
                <h2>Feedback</h2>
                <span>Listener notes</span>
              </div>

              <div className="form-grid">
                <label>
                  Rating
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={feedbackForm.rating}
                    onChange={(event) => updateFeedbackField("rating", event.target.value)}
                  />
                </label>

                <label>
                  Listens
                  <input
                    type="number"
                    min="0"
                    value={feedbackForm.listen_count}
                    onChange={(event) => updateFeedbackField("listen_count", event.target.value)}
                  />
                </label>

                <label>
                  Sentiment
                  <input
                    type="number"
                    step="0.1"
                    min="-1"
                    max="1"
                    value={feedbackForm.sentiment_score}
                    onChange={(event) => updateFeedbackField("sentiment_score", event.target.value)}
                  />
                </label>
              </div>

              <label>
                Comment
                <textarea
                  rows="3"
                  value={feedbackForm.comment}
                  onChange={(event) => updateFeedbackField("comment", event.target.value)}
                />
              </label>

              <div className="checks">
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

              <button type="submit">Save Feedback</button>

              <div className="feedback-list">
                {feedbackList.map((item) => (
                  <article key={item.id}>
                    <strong>Rating {item.rating ?? "N/A"}</strong>
                    <p>{item.comment || "No comment"}</p>
                    <span>{item.liked ? "Liked" : "Not liked"} - {item.listen_count} listens</span>
                  </article>
                ))}
              </div>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  
  console.log("Starting BeatsLuv app...");
  const root = createRoot(rootElement);
  root.render(<App />);
  console.log("App rendered successfully");
} catch (error) {
  console.error("Failed to render app:", error);
  document.body.innerHTML = `<div style="padding: 20px; color: red;"><h2>Error loading BeatsLuv</h2><p>${error.message}</p><p>Check browser console for more details</p></div>`;
}
