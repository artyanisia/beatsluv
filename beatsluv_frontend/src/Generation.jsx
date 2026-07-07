import React, { useEffect, useRef, useState } from "react";
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
  const generationFormRef = useRef(null);
  const [message, setMessage] = useState("");
  const [appAlert, setAppAlert] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTrack, setGeneratedTrack] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [recommendations, setRecommendations] = useState(null);
  const [versions, setVersions] = useState([]);
  const [parentTrackId, setParentTrackId] = useState(null);

  const [generationForm, setGenerationForm] = useState({
    prompt: "Creeaza un beat pop visator cu voci calde",
    genre: "pop",
    mood: "dreamy",
    tempo: 100,
    key_signature: "C major",
    ai_temperature: 0.7,
    duration_seconds: 30,
    is_public: true,
  });

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

  useEffect(() => {
    loadRecommendations();
  }, []);

  useEffect(() => {
    if (generatedTrack?.id) {
      loadVersions(generatedTrack.id);
    } else {
      setVersions([]);
    }
  }, [generatedTrack]);

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
        throw new Error(payload.detail || "Predictia a esuat");
      }
      setPrediction(payload);
    } catch (err) {
      setPredictionError(err.message);
    }
  }

  async function loadRecommendations() {
    try {
      const response = await fetch(`${API_BASE_URL}/predictions/recommendations`, {
        headers: {
          ...getAuthHeaders(),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        setRecommendations(payload);
      }
    } catch {
      setRecommendations(null);
    }
  }

  async function loadVersions(trackId) {
    try {
      const response = await fetch(`${API_BASE_URL}/tracks/${trackId}/versions`, {
        headers: {
          ...getAuthHeaders(),
        },
      });
      const payload = await response.json().catch(() => []);
      if (response.ok) {
        setVersions(payload);
      }
    } catch {
      setVersions([]);
    }
  }

  function applyRecommendation(recommendation) {
    setGenerationForm((current) => ({
      ...current,
      prompt: recommendation.prompt || current.prompt,
      genre: recommendation.genre || current.genre,
      mood: recommendation.mood || current.mood,
      tempo: recommendation.tempo || current.tempo,
      duration_seconds: recommendation.duration_seconds || current.duration_seconds,
    }));
  }

  function startPromptVariation(track) {
    setParentTrackId(track.id);
    setMessage(`Variatia pentru "${track.title}" a fost incarcata. Verifica promptul si apasa Genereaza piesa.`);
    setGenerationForm((current) => ({
      ...current,
      prompt: `${track.prompt} cu un refren mai puternic si un aranjament mai rafinat`,
      genre: track.genre || current.genre,
      mood: track.mood || current.mood,
      tempo: track.tempo || current.tempo,
      duration_seconds: track.duration_seconds || current.duration_seconds,
      key_signature: track.key_signature || current.key_signature,
    }));

    window.setTimeout(() => {
      generationFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function resetGeneration() {
    setGeneratedTrack(null);
    setShowFeedback(false);
    setParentTrackId(null);
    setMessage("");
    setFeedbackForm({
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
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setIsGenerating(true);
    setMessage("Se genereaza piesa...");
    resetGeneration();

    const payload = {
      ...generationForm,
      tempo: generationForm.tempo ? Number(generationForm.tempo) : null,
      duration_seconds: Number(generationForm.duration_seconds),
      ai_temperature: Number(generationForm.ai_temperature),
      is_public: Boolean(generationForm.is_public),
      parent_track_id: parentTrackId,
      predicted_rating: prediction?.predicted_rating || null,
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
        throw new Error(data.detail || "Nu s-a putut genera piesa");
      }

      setGeneratedTrack(data);
      setParentTrackId(null);
      setShowFeedback(true);
      setAppAlert({
        title: "Piesa creata",
        message: `"${data.title}" este gata pentru ascultare si feedback.`,
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
      setMessage("Nu exista o piesa pentru feedback.");
      return;
    }

    const payload = {
      ...feedbackForm,
      rating: feedbackForm.rating ? Number(feedbackForm.rating) : null,
      melody_rating: Number(feedbackForm.melody_rating),
      originality_rating: Number(feedbackForm.originality_rating),
      emotional_impact_rating: Number(feedbackForm.emotional_impact_rating),
      commercial_potential_rating: Number(feedbackForm.commercial_potential_rating),
      production_quality_rating: Number(feedbackForm.production_quality_rating),
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
        throw new Error(data.detail || "Cererea de feedback a esuat.");
      }

      setFeedbackForm((current) => ({ ...current, comment: "" }));
      setAppAlert({
        title: "Feedback salvat",
        message: `Feedbackul pentru "${generatedTrack.title}" a fost salvat.`,
      });
    } catch (error) {
      setMessage(error.message);
    }
  }

  const generatedTrackAudioUrl = generatedTrack?.audio_url ? buildAudioUrl(generatedTrack.audio_url) : "";
  const feedbackCriterii = [
    ["melody_rating", "Melodie"],
    ["originality_rating", "Originalitate"],
    ["emotional_impact_rating", "Impact emotional"],
    ["commercial_potential_rating", "Potential comercial"],
    ["production_quality_rating", "Calitate productie"],
  ];

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
                  Predictie popularitate
                </h3>
                <p className="card-subtitle">Obtine o predictie AI pentru cat de populara ar putea fi piesa ta</p>
              </div>
            </div>
            <div className="card-content">
              <form onSubmit={handlePredictionSubmit}>
                <div className="form-grid compact">
                  <div className="form-group">
                    <label htmlFor="pred-genre">Gen Muzical</label>
                    <input
                      id="pred-genre"
                      value={predictionForm.genre}
                      onChange={(event) => updatePredictionField("genre", event.target.value)}
                      placeholder="rock, pop, jazz..."
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pred-mood">Sentiment</label>
                    <input
                      id="pred-mood"
                      value={predictionForm.mood}
                      onChange={(event) => updatePredictionField("mood", event.target.value)}
                      placeholder="energetic, chill, fericit..."
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pred-key">Tonalitate</label>
                    <input
                      id="pred-key"
                      value={predictionForm.key_signature}
                      onChange={(event) => updatePredictionField("key_signature", event.target.value)}
                      placeholder="Do major, La minor..."
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
                    <label htmlFor="pred-duration">Durata (secunde)</label>
                    <input
                      id="pred-duration"
                      type="number"
                      value={predictionForm.duration_seconds}
                      onChange={(event) => updatePredictionField("duration_seconds", event.target.value)}
                      placeholder="180"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pred-temperature">Temperatura AI</label>
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
                  Prezice popularitatea
                </button>
                
                {prediction && (
                  <div className="prediction-result">
                    <strong>Estimare popularitate: {prediction.predicted_rating}/5 ({prediction.success_score}%)</strong>
                    <span>
                      Incredere {Math.round((prediction.confidence || 0) * 100)}% bazata pe {prediction.training_samples} piese evaluate
                    </span>
                    {prediction.explanation?.length > 0 && (
                      <ul className="compact-insight-list">
                        {prediction.explanation.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {predictionError && <p className="empty-state">{predictionError}</p>}
              </form>
            </div>
          </div>

          {recommendations && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <Icon name="star" />
                    Motor de recomandari
                  </h3>
                  <p className="card-subtitle">Sugestii calculate pe baza evaluarilor si tendintelor platformei</p>
                </div>
              </div>
              <div className="card-content">
                <div className="recommendation-grid">
                  {recommendations.prompt_suggestions?.map((item) => (
                    <button
                      key={`${item.title}-${item.genre}-${item.mood}`}
                      type="button"
                      className="recommendation-card"
                      onClick={() => applyRecommendation(item)}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.avg_rating ? `${item.avg_rating}/5 evaluare medie` : "Sugestie initiala"}</span>
                      <small>{item.prompt}</small>
                    </button>
                  ))}
                </div>
                {recommendations.insights?.length > 0 && (
                  <ul className="compact-insight-list">
                    {recommendations.insights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Generation Form */}
          <div className="card" ref={generationFormRef}>
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <Icon name="music" />
                  Genereaza muzica
                </h3>
                <p className="card-subtitle">Creeaza piese muzicale cu AI si parametri personalizati</p>
              </div>
              {generatedTrack && (
                <button type="button" onClick={resetGeneration} className="btn-secondary">
                  <Icon name="refresh" />
                  Genereaza alta piesa
                </button>
              )}
            </div>
            <div className="card-content">
              {parentTrackId && (
                <div className="status-message version-context">
                  Creezi o versiune noua pornind de la piesa #{parentTrackId}.
                  <button type="button" className="btn-secondary" onClick={() => setParentTrackId(null)}>
                    Sterge legatura
                  </button>
                </div>
              )}
              <form onSubmit={handleGenerate}>
                <div className="form-group">
                  <label htmlFor="prompt">Descrie piesa</label>
                  <textarea
                    id="prompt"
                    rows="4"
                    value={generationForm.prompt}
                    onChange={(event) => updateGenerationField("prompt", event.target.value)}
                    placeholder="Descrie muzica pe care vrei sa o generezi: stil, instrumente, atmosfera etc."
                    disabled={isGenerating}
                  />
                  <small className="form-hint">
                    Exemplu: "O piesa lo-fi hip hop relaxata, cu pian cald si tobe lente"
                  </small>
                </div>

                <div className="form-grid compact">
                  <div className="form-group">
                    <label htmlFor="genre">Gen</label>
                    <input
                      id="genre"
                      value={generationForm.genre}
                      onChange={(event) => updateGenerationField("genre", event.target.value)}
                      placeholder="pop, rock, jazz, electronic..."
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="mood">Sentiment</label>
                    <input
                      id="mood"
                      value={generationForm.mood}
                      onChange={(event) => updateGenerationField("mood", event.target.value)}
                      placeholder="vesel, trist, energic, chill..."
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
                    <label htmlFor="duration">Durata (secunde)</label>
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
                    <small className="form-hint">10-300 secunde</small>
                  </div>
                </div>

                <div className="form-grid compact">
                  <div className="form-group">
                    <label htmlFor="key-signature">Tonalitate</label>
                    <input
                      id="key-signature"
                      value={generationForm.key_signature}
                      onChange={(event) => updateGenerationField("key_signature", event.target.value)}
                      placeholder="Do major, La minor..."
                      disabled={isGenerating}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="ai-temperature">Temperatura AI</label>
                    <input
                      id="ai-temperature"
                      type="number"
                      step="0.01"
                      min="0"
                      max="2"
                      value={generationForm.ai_temperature}
                      onChange={(event) => updateGenerationField("ai_temperature", event.target.value)}
                      disabled={isGenerating}
                    />
                    <small className="form-hint">Mai mica inseamna mai sigur, mai mare inseamna mai experimental.</small>
                  </div>
                </div>

                <label className="inline-checkbox generation-visibility-choice">
                  <input
                    type="checkbox"
                    checked={generationForm.is_public}
                    onChange={(event) => updateGenerationField("is_public", event.target.checked)}
                    disabled={isGenerating}
                  />
                  Fa piesa publica in biblioteca
                </label>

                <button type="submit" disabled={isGenerating} className="btn-primary generate-button">
                  {isGenerating && <div className="spinner compact-spinner" />}
                  <Icon name="music" />
                  {isGenerating ? "Se genereaza piesa..." : "Genereaza piesa"}
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
                  <h2 className="track-success-title">Piesa ta noua</h2>
                  <p className="track-success-subtitle">{generatedTrack.title}</p>
                </div>
              </div>

              <div className="track-details-card">
                <div className="track-info-grid">
                  <div className="track-info-item">
                    <div className="info-label">ID piesa</div>
                    <div className="info-value">#{generatedTrack.id}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Gen</div>
                    <div className="info-value">{generatedTrack.genre || "Mixt"}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Sentiment</div>
                    <div className="info-value">{generatedTrack.mood || "Echilibrata"}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Durata</div>
                    <div className="info-value">{generatedTrack.duration_seconds}s</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Tempo</div>
                    <div className="info-value">{generatedTrack.tempo ? `${generatedTrack.tempo} BPM` : "Variabil"}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Tonalitate</div>
                    <div className="info-value">{generatedTrack.key_signature || "Indisponibil"}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">AI Temp</div>
                    <div className="info-value">{generatedTrack.ai_temperature || generationForm.ai_temperature}</div>
                  </div>
                  {prediction && (
                    <div className="track-info-item">
                      <div className="info-label">Scor prezis</div>
                      <div className="info-value">{prediction.success_score}%</div>
                    </div>
                  )}
                  <div className="track-info-item">
                    <div className="info-label">Creata</div>
                    <div className="info-value">{new Date().toLocaleDateString()}</div>
                  </div>
                  <div className="track-info-item">
                    <div className="info-label">Vizibilitate</div>
                    <div className="info-value">{generatedTrack.is_public ? "Public" : "Privat"}</div>
                  </div>
                </div>

                {generatedTrack.prompt && (
                  <div className="prompt-section">
                    <h4 className="section-title">Prompt original</h4>
                    <div className="prompt-display">
                      {generatedTrack.prompt}
                    </div>
                    <button
                      type="button"
                      className="btn-secondary create-version-button"
                      onClick={() => startPromptVariation(generatedTrack)}
                    >
                      <Icon name="refresh" />
                      Creeaza variatie de prompt
                    </button>
                  </div>
                )}

                {versions.length > 0 && (
                  <div className="prompt-section">
                    <h4 className="section-title">Istoric versiuni prompt</h4>
                    <div className="version-list">
                      {versions.map((version) => (
                        <div key={version.id} className="version-item">
                          <strong>v{version.version_number}: {version.title}</strong>
                          <span>
                            {version.genre || "Mixt"} / {version.mood || "Echilibrat"} / {version.tempo || "Variabil"} BPM
                          </span>
                          <p>{version.prompt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="audio-section">
                  <h4 className="section-title">
                    <Icon name="music" />
                    Asculta piesa
                  </h4>
                  <div className="audio-player-container">
                    {generatedTrackAudioUrl ? (
                      <audio controls src={generatedTrackAudioUrl} className="audio-player" />
                    ) : (
                      <p className="empty-state">Nu a fost returnat niciun fisier audio generat.</p>
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
                    Evalueaza piesa
                  </h3>
                  <p className="card-subtitle">Ajuta-ne sa imbunatatim rezultatele prin feedbackul tau</p>
                </div>
              </div>
              <div className="card-content">
                <form className="compact-feedback-form" onSubmit={handleFeedbackSubmit}>
                  <div className="rating-section">
                    <label>Rating general</label>
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

                  <div className="structured-rating-grid">
                    {feedbackCriterii.map(([field, label]) => (
                      <div className="feedback-criterion" key={field}>
                        <label htmlFor={field}>{label}</label>
                        <input
                          id={field}
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

                  <div className="form-group feedback-comment-group">
                    <label htmlFor="feedback-comment">Comentarii (optional)</label>
                    <textarea
                      id="feedback-comment"
                      rows="2"
                      value={feedbackForm.comment}
                      onChange={(event) => updateFeedbackField("comment", event.target.value)}
                      placeholder="Observatii scurte despre piesa"
                    />
                  </div>

                  <div className="feedback-actions">
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={feedbackForm.liked}
                        onChange={(event) => updateFeedbackField("liked", event.target.checked)}
                      />
                      Mi-a placut
                    </label>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={feedbackForm.downloaded}
                        onChange={(event) => updateFeedbackField("downloaded", event.target.checked)}
                      />
                      Descarcare
                    </label>
                    <label className="inline-checkbox">
                      <input
                        type="checkbox"
                        checked={feedbackForm.shared}
                        onChange={(event) => updateFeedbackField("shared", event.target.checked)}
                      />
                      Distribuire
                    </label>
                  </div>

                  <button type="submit" className="btn-primary full-width">
                    <Icon name="heart" />
                    Trimite feedback
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


