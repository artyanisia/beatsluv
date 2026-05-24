import React, { useState } from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

function Icon({ name }) {
  const icons = {
    music: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
    heart: (
      <>
        <path d="m19,14c0,5-7,7-7,7s-7-2-7-7a4.5,4.5 0 0,1 9,0c0-2.5,2-4.5,4.5-4.5s4.5,2,4.5,4.5z" />
      </>
    ),
    star: (
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.86 1.18 6.87L12 17.77 5.82 21 7 14.13l-5-4.86 6.91-1.01L12 2Z" />
    ),
    refresh: (
      <>
        <path d="M21 12a9 9 0 0 1-15.5 6.2" />
        <path d="M3 12A9 9 0 0 1 18.5 5.8" />
        <path d="M18 2v4h-4" />
        <path d="M6 22v-4h4" />
      </>
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

const Generation = () => {
  const { getAuthHeaders } = useAuth();
  const [message, setMessage] = useState("");
  const [appAlert, setAppAlert] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTrack, setGeneratedTrack] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const [generationForm, setGenerationForm] = useState({
    prompt: "Create a dreamy pop beat with soft vocals",
    genre: "pop",
    mood: "dreamy",
    tempo: 100,
    duration_seconds: 30,
    is_public: true,
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

  const [predictionForm, setPredictionForm] = useState({
    genre: "rock",
    mood: "energetic",
    key_signature: "C major",
    tempo: 120,
    duration_seconds: 180,
    ai_temperature: 0.7,
  });
  const [prediction, setPrediction] = useState(null);
  const [predictionError, setPredictionError] = useState("");

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

  function updatePredictionField(field, value) {
    setPredictionForm((current) => ({ ...current, [field]: value }));
  }

  async function handlePredictionSubmit(event) {
    event.preventDefault();
    setPredictionError("");
    setPrediction(null);

    try {
      const response = await fetch(`${API_BASE_URL}/predictions/popularity`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...predictionForm,
          tempo: Number(predictionForm.tempo),
          duration_seconds: Number(predictionForm.duration_seconds),
          ai_temperature: Number(predictionForm.ai_temperature),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || "Prediction failed");
      }
      setPrediction(payload);
    } catch (err) {
      setPredictionError(err.message);
    }
  }

  function resetGeneration() {
    setGeneratedTrack(null);
    setShowFeedback(false);
    setMessage("");
    setFeedbackForm({
      rating: 5,
      comment: "",
      liked: true,
      downloaded: false,
      shared: false,
      listen_count: 1,
      sentiment_score: 0.8,
    });
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setIsGenerating(true);
    setMessage("Generating track...");
    resetGeneration();

    const payload = {
      ...generationForm,
      tempo: generationForm.tempo ? Number(generationForm.tempo) : null,
      duration_seconds: Number(generationForm.duration_seconds),
      is_public: Boolean(generationForm.is_public),
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

      setGeneratedTrack(data);
      setShowFeedback(true);
      setAppAlert({
        title: "Track Created",
        message: `"${data.title}" is ready to play and review.`,
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleFeedbackSubmit(event) {
    event.preventDefault();

    if (!generatedTrack) {
      setMessage("No track to give feedback on.");
      return;
    }

    const payload = {
      ...feedbackForm,
      rating: feedbackForm.rating ? Number(feedbackForm.rating) : null,
      listen_count: Number(feedbackForm.listen_count),
      sentiment_score: feedbackForm.sentiment_score ? Number(feedbackForm.sentiment_score) : null,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/tracks/${generatedTrack.id}/feedback`, {
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

      setFeedbackForm((current) => ({ ...current, comment: "" }));
      setAppAlert({
        title: "Feedback Saved",
        message: `Your feedback for "${generatedTrack.title}" was saved.`,
      });
    } catch (error) {
      setMessage(error.message);
    }
  }

  const generatedTrackAudioUrl = generatedTrack?.audio_url ? buildAudioUrl(generatedTrack.audio_url) : "";

  return (
    <div className="generation-page">
      {message && <div className="status-message">{message}</div>}
      {appAlert && (
        <div className="app-alert-overlay" role="dialog" aria-modal="true" aria-labelledby="generation-alert-title">
          <div className="app-alert-card">
            <h3 id="generation-alert-title">{appAlert.title}</h3>
            <p>{appAlert.message}</p>
            <button type="button" onClick={() => setAppAlert(null)}>
              OK
            </button>
          </div>
        </div>
      )}

      <div className="generation-grid">
        <div className="generation-main">
          {/* Popularity Prediction Form */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <Icon name="star" />
                  Popularity Prediction
                </h3>
                <p className="card-subtitle">Get an AI prediction for how popular your track might be</p>
              </div>
            </div>
            <div className="card-content">
              <form onSubmit={handlePredictionSubmit}>
                <div className="form-grid compact">
                  <div className="form-group">
                    <label htmlFor="pred-genre">Genre</label>
                    <input
                      id="pred-genre"
                      value={predictionForm.genre}
                      onChange={(event) => updatePredictionField("genre", event.target.value)}
                      placeholder="rock, pop, jazz..."
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pred-mood">Mood</label>
                    <input
                      id="pred-mood"
                      value={predictionForm.mood}
                      onChange={(event) => updatePredictionField("mood", event.target.value)}
                      placeholder="energetic, chill, happy..."
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pred-key">Key Signature</label>
                    <input
                      id="pred-key"
                      value={predictionForm.key_signature}
                      onChange={(event) => updatePredictionField("key_signature", event.target.value)}
                      placeholder="C major, A minor..."
                    />
                  </div>
                </div>
                <div className="form-grid compact">
                  <div className="form-group">
                    <label htmlFor="pred-tempo">Tempo (BPM)</label>
                    <input
                      id="pred-tempo"
                      type="number"
                      value={predictionForm.tempo}
                      onChange={(event) => updatePredictionField("tempo", event.target.value)}
                      placeholder="120"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pred-duration">Duration (seconds)</label>
                    <input
                      id="pred-duration"
                      type="number"
                      value={predictionForm.duration_seconds}
                      onChange={(event) => updatePredictionField("duration_seconds", event.target.value)}
                      placeholder="180"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pred-temperature">AI Temperature</label>
                    <input
                      id="pred-temperature"
                      type="number"
                      step="0.01"
                      min="0"
                      max="2"
                      value={predictionForm.ai_temperature}
                      onChange={(event) => updatePredictionField("ai_temperature", event.target.value)}
                      placeholder="0.7"
                    />
                  </div>
                </div>
                <button type="submit" className="btn-secondary">
                  <Icon name="star" />
                  Predict Popularity
                </button>
                
                {prediction && (
                  <div className="prediction-result">
                    <strong>Estimated popularity: {prediction.predicted_rating}/5</strong>
                    <span>
                      Based on analysis of {prediction.training_samples} similar tracks
                    </span>
                  </div>
                )}
                {predictionError && <p className="empty-state">{predictionError}</p>}
              </form>
            </div>
          </div>

          {/* Generation Form */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <Icon name="music" />
                  Generate Music
                </h3>
                <p className="card-subtitle">Create AI-powered music tracks with custom parameters</p>
              </div>
              {generatedTrack && (
                <button type="button" onClick={resetGeneration} className="btn-secondary">
                  <Icon name="refresh" />
                  Generate New Track
                </button>
              )}
            </div>
            <div className="card-content">
              <form onSubmit={handleGenerate}>
                <div className="form-group">
                  <label htmlFor="prompt">Describe Your Track</label>
                  <textarea
                    id="prompt"
                    rows="4"
                    value={generationForm.prompt}
                    onChange={(event) => updateGenerationField("prompt", event.target.value)}
                    placeholder="Describe the music you want to generate... Be specific about style, instruments, mood, etc."
                    disabled={isGenerating}
                  />
                  <small className="form-hint">
                    Example: "A chill lo-fi hip hop track with vinyl crackle, soft piano, and gentle drums"
                  </small>
                </div>

                <div className="form-grid compact">
                  <div className="form-group">
                    <label htmlFor="genre">Genre</label>
                    <input
                      id="genre"
                      value={generationForm.genre}
                      onChange={(event) => updateGenerationField("genre", event.target.value)}
                      placeholder="pop, rock, jazz, electronic..."
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="mood">Mood</label>
                    <input
                      id="mood"
                      value={generationForm.mood}
                      onChange={(event) => updateGenerationField("mood", event.target.value)}
                      placeholder="happy, sad, energetic, chill..."
                      disabled={isGenerating}
                    />
                  </div>
                </div>

                <div className="form-grid compact">
                  <div className="form-group">
                    <label htmlFor="tempo">Tempo (BPM)</label>
                    <input
                      id="tempo"
                      type="number"
                      min="60"
                      max="180"
                      value={generationForm.tempo}
                      onChange={(event) => updateGenerationField("tempo", event.target.value)}
                      placeholder="120"
                      disabled={isGenerating}
                    />
                    <small className="form-hint">60-180 BPM</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="duration">Duration (seconds)</label>
                    <input
                      id="duration"
                      type="number"
                      min="10"
                      max="300"
                      value={generationForm.duration_seconds}
                      onChange={(event) => updateGenerationField("duration_seconds", event.target.value)}
                      placeholder="30"
                      disabled={isGenerating}
                    />
                    <small className="form-hint">10-300 seconds</small>
                  </div>
                </div>

                <label className="inline-checkbox generation-visibility-choice">
                  <input
                    type="checkbox"
                    checked={generationForm.is_public}
                    onChange={(event) => updateGenerationField("is_public", event.target.checked)}
                    disabled={isGenerating}
                  />
                  Make this track public in Track Library
                </label>

                <button type="submit" disabled={isGenerating} className="btn-primary generate-button">
                  {isGenerating && <div className="spinner compact-spinner" />}
                  <Icon name="music" />
                  {isGenerating ? "Generating Your Track..." : "Generate Track"}
                </button>
              </form>
            </div>
          </div>

          {/* Generated Track Display */}
          {generatedTrack && (
            <div className="track-result-container">
              <div className="track-result-header">
                <div className="track-success-icon">
                  <Icon name="music" />
                </div>
                <div className="track-success-content">
                  <h2 className="track-success-title">Your New Track</h2>
                  <p className="track-success-subtitle">{generatedTrack.title}</p>
                </div>
              </div>

              <div className="track-details-card">
                <div className="track-info-grid">
                  <div className="track-info-item">
                    <div className="info-label">Track ID</div>
                    <div className="info-value">#{generatedTrack.id}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Genre</div>
                    <div className="info-value">{generatedTrack.genre || "Mixed"}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Mood</div>
                    <div className="info-value">{generatedTrack.mood || "Balanced"}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Duration</div>
                    <div className="info-value">{generatedTrack.duration_seconds}s</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Tempo</div>
                    <div className="info-value">{generatedTrack.tempo ? `${generatedTrack.tempo} BPM` : "Variable"}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Created</div>
                    <div className="info-value">{new Date().toLocaleDateString()}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Visibility</div>
                    <div className="info-value">{generatedTrack.is_public ? "Public" : "Private"}</div>
                  </div>
                </div>

                {generatedTrack.prompt && (
                  <div className="prompt-section">
                    <h4 className="section-title">Original Prompt</h4>
                    <div className="prompt-display">
                      {generatedTrack.prompt}
                    </div>
                  </div>
                )}

                <div className="audio-section">
                  <h4 className="section-title">
                    <Icon name="music" />
                    Listen to Your Track
                  </h4>
                  <div className="audio-player-container">
                    {generatedTrackAudioUrl ? (
                      <audio controls src={generatedTrackAudioUrl} className="audio-player" />
                    ) : (
                      <p className="empty-state">No generated audio file was returned.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feedback Section */}
        {showFeedback && generatedTrack && (
          <div className="generation-sidebar">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <Icon name="heart" />
                    Rate Your Track
                  </h3>
                  <p className="card-subtitle">Help us improve by sharing your feedback</p>
                </div>
              </div>
              <div className="card-content">
                <form onSubmit={handleFeedbackSubmit}>
                  <div className="rating-section">
                    <label>Overall Rating</label>
                    <div className="star-rating">
                      {[...Array(5)].map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`star-button ${i < feedbackForm.rating ? "star-filled" : "star-empty"}`}
                          onClick={() => updateFeedbackField("rating", i + 1)}
                        >
                          <Icon name="star" />
                        </button>
                      ))}
                      <span className="rating-text">{feedbackForm.rating}/5</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="feedback-comment">Comments (Optional)</label>
                    <textarea
                      id="feedback-comment"
                      rows="4"
                      value={feedbackForm.comment}
                      onChange={(event) => updateFeedbackField("comment", event.target.value)}
                      placeholder="What did you think? Any specific parts you loved or would improve?"
                    />
                  </div>

                  <div className="feedback-actions">
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={feedbackForm.liked}
                        onChange={(event) => updateFeedbackField("liked", event.target.checked)}
                      />
                      I liked this track
                    </label>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={feedbackForm.downloaded}
                        onChange={(event) => updateFeedbackField("downloaded", event.target.checked)}
                      />
                      I want to download this
                    </label>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={feedbackForm.shared}
                        onChange={(event) => updateFeedbackField("shared", event.target.checked)}
                      />
                      I would share this track
                    </label>
                  </div>

                  <button type="submit" className="btn-primary full-width">
                    <Icon name="heart" />
                    Submit Feedback
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Generation;
