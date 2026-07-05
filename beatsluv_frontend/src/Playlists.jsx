import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

function Icon({ name }) {
  const icons = {
    playlist: (
      <>
        <path d="M4 6h11" />
        <path d="M4 12h9" />
        <path d="M4 18h7" />
        <path d="M17 14v6" />
        <circle cx="15" cy="20" r="2" />
        <path d="M17 14l4-1v5" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
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

function formatDurata(seconds) {
  const total = Number(seconds || 0);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function Playlists() {
  const { getAuthHeaders } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [publicPiese, setPublicPiese] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({
    name: "",
    description: "",
    is_public: false,
  });
  const [selectedTrackId, setSelectedTrackId] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedPlaylistId) {
      loadPlaylist(selectedPlaylistId);
    } else {
      setSelectedPlaylist(null);
    }
  }, [selectedPlaylistId]);

  const playlistPiese = selectedPlaylist?.tracks || [];
  const playlistTrackIds = useMemo(
    () => new Set(playlistPiese.map((track) => Number(track.id))),
    [playlistPiese],
  );
  const availablePiese = publicPiese.filter((track) => !playlistTrackIds.has(Number(track.id)));

  async function apiFetch(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.detail || "Cererea pentru playlist a esuat");
    }
    return payload;
  }

  async function loadInitialData() {
    setLoading(true);
    setMessage("");
    try {
      const [playlistData, trackData] = await Promise.all([
        apiFetch("/playlists"),
        apiFetch("/tracks/public"),
      ]);
      setPlaylists(playlistData);
      setPublicPiese(trackData);
      if (playlistData.length && !selectedPlaylistId) {
        setSelectedPlaylistId(String(playlistData[0].id));
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaylists(nextSelectedId = selectedPlaylistId) {
    const playlistData = await apiFetch("/playlists");
    setPlaylists(playlistData);
    if (nextSelectedId) {
      setSelectedPlaylistId(String(nextSelectedId));
    } else if (playlistData.length) {
      setSelectedPlaylistId(String(playlistData[0].id));
    } else {
      setSelectedPlaylistId("");
    }
  }

  async function loadPlaylist(playlistId) {
    try {
      setSelectedPlaylist(await apiFetch(`/playlists/${playlistId}`));
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleCreatePlaylist(event) {
    event.preventDefault();
    const name = newPlaylist.name.trim();
    if (!name) {
      setMessage("Numele playlistului este obligatoriu.");
      return;
    }

    try {
      const created = await apiFetch("/playlists", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: newPlaylist.description.trim() || null,
          is_public: Boolean(newPlaylist.is_public),
        }),
      });
      setNewPlaylist({ name: "", description: "", is_public: false });
      setMessage(`Playlistul "${created.name}" a fost creat.`);
      await loadPlaylists(created.id);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleAdaugaTrack(event) {
    event.preventDefault();
    if (!selectedPlaylistId || !selectedTrackId) {
      setMessage("Alege mai intai un playlist si o piesa.");
      return;
    }

    try {
      await apiFetch(`/playlists/${selectedPlaylistId}/tracks`, {
        method: "POST",
        body: JSON.stringify({ track_id: Number(selectedTrackId) }),
      });
      setSelectedTrackId("");
      setMessage("Piesa a fost adaugata in playlist.");
      await Promise.all([loadPlaylist(selectedPlaylistId), loadPlaylists(selectedPlaylistId)]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleRemoveTrack(trackId) {
    if (!selectedPlaylistId) {
      return;
    }

    try {
      await apiFetch(`/playlists/${selectedPlaylistId}/tracks/${trackId}`, {
        method: "DELETE",
      });
      setMessage("Piesa a fost eliminata din playlist.");
      await Promise.all([loadPlaylist(selectedPlaylistId), loadPlaylists(selectedPlaylistId)]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleVizibilitateChange(isPublic) {
    if (!selectedPlaylistId) {
      return;
    }

    try {
      const updated = await apiFetch(`/playlists/${selectedPlaylistId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_public: isPublic }),
      });
      setSelectedPlaylist((current) => ({ ...current, ...updated }));
      await loadPlaylists(selectedPlaylistId);
      setMessage(`Playlistul este acum ${isPublic ? "public" : "privat"}.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleStergePlaylist(playlistId) {
    if (!window.confirm("Stergi acest playlist?")) {
      return;
    }

    try {
      await apiFetch(`/playlists/${playlistId}`, { method: "DELETE" });
      setMessage("Playlistul a fost sters.");
      await loadPlaylists("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="playlists-page">
      {message && <div className="status-message">{message}</div>}

      <section className="playlist-hero card">
        <div>
          <h2>Playlisturi muzicale</h2>
          <p>
            Aici iti poti vedea playlisturile salvate, poti crea colectii noi si poti organiza piesele preferate.
          </p>
        </div>
        <div className="playlist-hero-stat">
          <Icon name="playlist" />
          <strong>{playlists.length}</strong>
          <span>playlisturi</span>
        </div>
      </section>

      <div className="playlist-layout">
        <aside className="playlist-sidebar card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Playlisturile tale</h3>
              <p className="card-subtitle">Colectii create din piesele salvate</p>
            </div>
            <button type="button" className="icon-button" onClick={loadInitialData} disabled={loading}>
              <Icon name="playlist" />
            </button>
          </div>
          <div className="card-content">
            {playlists.length === 0 ? (
              <p className="empty-state">Nu ai playlisturi inca.</p>
            ) : (
              <div className="playlist-list">
                {playlists.map((playlist) => (
                  <button
                    type="button"
                    key={playlist.id}
                    className={`playlist-list-item ${String(playlist.id) === String(selectedPlaylistId) ? "active" : ""}`}
                    onClick={() => setSelectedPlaylistId(String(playlist.id))}
                  >
                    <span>
                      <strong>{playlist.name}</strong>
                      <small>
                        {playlist.track_count} piese / {formatDurata(playlist.total_duration_seconds)}
                      </small>
                    </span>
                    <em>{playlist.is_public ? "Public" : "Privat"}</em>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="playlist-main">
          <section className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Creeaza playlist</h3>
                <p className="card-subtitle">O colectie noua salvata in contul tau</p>
              </div>
            </div>
            <div className="card-content">
              <form className="playlist-create-form" onSubmit={handleCreatePlaylist}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="playlist-name">Nume</label>
                    <input
                      id="playlist-name"
                      value={newPlaylist.name}
                      onChange={(event) => setNewPlaylist((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Exemplu: Beat-uri de seara"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="playlist-description">Descriere</label>
                    <input
                      id="playlist-description"
                      value={newPlaylist.description}
                      onChange={(event) =>
                        setNewPlaylist((current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Descriere scurta pentru playlist"
                    />
                  </div>
                </div>
                <label className="inline-checkbox">
                  <input
                    type="checkbox"
                    checked={newPlaylist.is_public}
                    onChange={(event) =>
                      setNewPlaylist((current) => ({ ...current, is_public: event.target.checked }))
                    }
                  />
                  Fa playlistul public
                </label>
                <button type="submit">
                  <Icon name="plus" />
                  Creeaza playlist
                </button>
              </form>
            </div>
          </section>

          {selectedPlaylist && (
            <section className="card playlist-detail-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{selectedPlaylist.name}</h3>
                  <p className="card-subtitle">
                    {selectedPlaylist.description || "Fara descriere"} / {selectedPlaylist.is_public ? "Public" : "Privat"}
                  </p>
                </div>
                <div className="playlist-header-actions">
                  <label className="visibility-toggle">
                    <span className="toggle-label">{selectedPlaylist.is_public ? "Public" : "Privat"}</span>
                    <span className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedPlaylist.is_public)}
                        onChange={(event) => handleVizibilitateChange(event.target.checked)}
                      />
                      <span className="toggle-slider" />
                    </span>
                  </label>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleStergePlaylist(selectedPlaylist.id)}
                  >
                    <Icon name="trash" />
                    Sterge
                  </button>
                </div>
              </div>
              <div className="card-content">
                <div className="playlist-summary-grid">
                  <div>
                    <span>Piese</span>
                    <strong>{playlistPiese.length}</strong>
                  </div>
                  <div>
                    <span>Durata totala</span>
                    <strong>
                      {formatDurata(playlistPiese.reduce((sum, track) => sum + Number(track.duration_seconds || 0), 0))}
                    </strong>
                  </div>
                  <div>
                    <span>Rating mediu</span>
                    <strong>{selectedPlaylist.avg_rating || "Indisponibil"}</strong>
                  </div>
                </div>

                <form className="playlist-add-track" onSubmit={handleAdaugaTrack}>
                  <label htmlFor="playlist-track-select">Adauga piesa publica</label>
                  <div>
                    <select
                      id="playlist-track-select"
                      value={selectedTrackId}
                      onChange={(event) => setSelectedTrackId(event.target.value)}
                    >
                      <option value="">Alege o piesa</option>
                      {availablePiese.map((track) => (
                        <option key={track.id} value={track.id}>
                          #{track.id} - {track.title} ({track.genre || "Indisponibil"})
                        </option>
                      ))}
                    </select>
                    <button type="submit">
                      <Icon name="plus" />
                      Adauga
                    </button>
                  </div>
                </form>

                {playlistPiese.length === 0 ? (
                  <p className="empty-state">Acest playlist nu are piese inca.</p>
                ) : (
                  <div className="playlist-track-grid">
                    {playlistPiese.map((track) => (
                      <article key={track.id} className="playlist-track-card">
                        <div className="playlist-track-header">
                          <div>
                            <strong>{track.title}</strong>
                            <span>
                              {track.genre || "Indisponibil"} / {track.mood || "Indisponibil"} / {track.tempo || "Indisponibil"} BPM
                            </span>
                          </div>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => handleRemoveTrack(track.id)}
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                        <div className="track-meta">
                          <span>#{track.id}</span>
                          <span>{track.duration_seconds}s</span>
                          <span>{track.avg_rating ? `${track.avg_rating}/5` : "Fara rating"}</span>
                          <span>{track.feedback_count || 0} recenzii</span>
                        </div>
                        {track.audio_url ? (
                          <audio controls src={buildAudioUrl(track.audio_url)} />
                        ) : (
                          <p className="empty-state">Audio indisponibil.</p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default Playlists;


