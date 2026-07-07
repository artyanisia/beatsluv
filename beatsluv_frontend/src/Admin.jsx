import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";
const TAB_LABELS = {
  tracks: "Piese",
  playlists: "Playlisturi",
  users: "Utilizatori",
  feedback: "Feedback",
};

function AdminStat({ label, value }) {
  return (
    <div className="stat-card">
      <h3>{label}</h3>
      <div className="stat-number">{value}</div>
    </div>
  );
}

function AdminPage() {
  const { user, getAuthHeaders } = useAuth();
  const [activeTab, setActiveTab] = useState("tracks");
  const [overview, setOverview] = useState(null);
  const [users, setUtilizatori] = useState([]);
  const [tracks, setPiese] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [search, setCauta] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function adminFetch(path, options = {}) {
    const headers = {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    };

    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.detail || "Cererea de administrare a esuat");
    }
    return payload;
  }

  async function loadAdminData() {
    setLoading(true);
    setMessage("");
    try {
      const [overviewData, usersData, tracksData, playlistData, feedbackData] = await Promise.all([
        adminFetch("/admin/overview"),
        adminFetch("/admin/users"),
        adminFetch(`/admin/tracks?limit=120&search=${encodeURIComponent(search)}`),
        adminFetch(`/admin/playlists?limit=120&search=${encodeURIComponent(search)}`),
        adminFetch("/admin/feedback?limit=120"),
      ]);
      setOverview(overviewData);
      setUtilizatori(usersData);
      setPiese(tracksData);
      setPlaylists(playlistData);
      setFeedback(feedbackData);
    } catch (error) {
      setMessage(
        error.message === "Failed to fetch"
          ? `Backendul nu poate fi accesat la ${API_BASE_URL}. Verifica daca serverul API ruleaza.`
          : error.message,
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRol(userId, role) {
    try {
      await adminFetch(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMessage(`Rolul utilizatorului #${userId} a fost actualizat.`);
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateTrack(trackId, updates) {
    try {
      await adminFetch(`/admin/tracks/${trackId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setMessage(`Piesa #${trackId} a fost actualizata.`);
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteTrack(trackId) {
    if (!window.confirm(`Stergi piesa #${trackId} si feedbackul asociat?`)) {
      return;
    }
    try {
      await adminFetch(`/admin/tracks/${trackId}`, { method: "DELETE" });
      setMessage(`Piesa #${trackId} a fost stearsa.`);
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updatePlaylist(playlistId, updates) {
    try {
      await adminFetch(`/admin/playlists/${playlistId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      setMessage(`Playlistul #${playlistId} a fost actualizat.`);
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deletePlaylist(playlistId) {
    if (!window.confirm(`Stergi playlistul #${playlistId}?`)) {
      return;
    }
    try {
      await adminFetch(`/admin/playlists/${playlistId}`, { method: "DELETE" });
      setMessage(`Playlistul #${playlistId} a fost sters.`);
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteFeedback(feedbackId) {
    if (!window.confirm(`Stergi feedbackul #${feedbackId}?`)) {
      return;
    }
    try {
      await adminFetch(`/admin/feedback/${feedbackId}`, { method: "DELETE" });
      setMessage(`Feedbackul #${feedbackId} a fost sters.`);
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (user?.role !== "ADMIN" || user?.email !== "admin@gmail.com") {
    return (
      <section className="panel">
        <h2>Administrare</h2>
        <p className="empty-state">Ai nevoie de acces de administrator.</p>
      </section>
    );
  }

  return (
    <section className="admin-page">
      {message && <div className="status-message">{message}</div>}

      {overview && (
        <div className="stats-grid">
          <AdminStat label="Utilizatori" value={overview.users} />
          <AdminStat label="Administratori" value={overview.admins} />
          <AdminStat label="Piese" value={overview.tracks} />
          <AdminStat label="Cu audio" value={overview.playable_tracks} />
          <AdminStat label="Piese publice" value={overview.public_tracks} />
          <AdminStat label="Playlisturi" value={overview.playlists} />
          <AdminStat label="Playlisturi publice" value={overview.public_playlists} />
          <AdminStat label="Feedback" value={overview.feedback} />
          <AdminStat label="Cereri" value={overview.generation_requests} />
          <AdminStat label="Versiuni prompt" value={overview.prompt_versions} />
        </div>
      )}

      <div className="admin-toolbar">
        <div className="nav-actions">
          {["tracks", "playlists", "users", "feedback"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? "nav-button active" : "nav-button"}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <button type="button" onClick={loadAdminData} disabled={loading}>
          {loading ? "Se incarca..." : "Actualizeaza datele"}
        </button>
      </div>

      {activeTab === "tracks" && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <h2>Gestionare piese</h2>
            <span>Editeaza statusul si metadatele</span>
          </div>
          <div className="admin-search">
            <input
              value={search}
              placeholder="Cauta dupa titlu, gen sau sentiment"
              onChange={(event) => setCauta(event.target.value)}
            />
            <button type="button" onClick={loadAdminData}>Cauta</button>
          </div>
          <div className="admin-table">
            <div className="admin-row admin-row-header">
              <span>ID</span>
              <span>Titlu</span>
              <span>Status</span>
              <span>Gen</span>
              <span>Sentiment</span>
              <span>Tempo</span>
              <span>Public</span>
              <span>Rating</span>
              <span>Actiuni</span>
            </div>
            {tracks.map((track) => (
              <div className="admin-row" key={track.id}>
                <span>#{track.id}</span>
                <span>{track.title}</span>
                <select
                  value={track.status || "COMPLETED"}
                  onChange={(event) => updateTrack(track.id, { status: event.target.value })}
                >
                  <option value="COMPLETED">Finalizata</option>
                  <option value="PROCESSING">In procesare</option>
                  <option value="FAILED">Esuata</option>
                  <option value="HIDDEN">Ascunsa</option>
                </select>
                <input
                  defaultValue={track.genre || ""}
                  onBlur={(event) => updateTrack(track.id, { genre: event.target.value })}
                />
                <input
                  defaultValue={track.mood || ""}
                  onBlur={(event) => updateTrack(track.id, { mood: event.target.value })}
                />
                <input
                  type="number"
                  defaultValue={track.tempo || ""}
                  onBlur={(event) => updateTrack(track.id, { tempo: event.target.value ? Number(event.target.value) : null })}
                />
                <label className="toggle-switch" aria-label={`Schimba vizibilitatea publica pentru ${track.title}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(track.is_public)}
                    onChange={(event) => updateTrack(track.id, { is_public: event.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
                <span>{track.avg_rating || "Indisponibil"}</span>
                <button type="button" className="danger-button" onClick={() => deleteTrack(track.id)}>
                  Sterge
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "users" && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <h2>Gestionare utilizatori</h2>
            <span>Administreaza rolurile</span>
          </div>
          <div className="admin-table users-table">
            <div className="admin-row admin-row-header">
              <span>ID</span>
              <span>Email</span>
              <span>Rol</span>
              <span>Piese</span>
              <span>Feedback</span>
            </div>
            {users.map((account) => (
              <div className="admin-row" key={account.id}>
                <span>#{account.id}</span>
                <span>{account.email}</span>
                <select
                  value={account.role}
                  onChange={(event) => updateUserRol(account.id, event.target.value)}
                >
                  <option value="USER">Utilizator</option>
                  <option value="ADMIN">Administrator</option>
                </select>
                <span>{account.tracks_count}</span>
                <span>{account.feedback_count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "playlists" && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <h2>Gestionare playlisturi</h2>
            <span>Administreaza vizibilitatea si colectiile</span>
          </div>
          <div className="admin-search">
            <input
              value={search}
              placeholder="Cauta dupa nume, descriere sau proprietar"
              onChange={(event) => setCauta(event.target.value)}
            />
            <button type="button" onClick={loadAdminData}>Cauta</button>
          </div>
          <div className="admin-table playlist-admin-table">
            <div className="admin-row admin-row-header">
              <span>ID</span>
              <span>Nume</span>
              <span>Proprietar</span>
              <span>Piese</span>
              <span>Vizibilitate</span>
              <span>Rating</span>
              <span>Actiuni</span>
            </div>
            {playlists.map((playlist) => (
              <div className="admin-row" key={playlist.id}>
                <span>#{playlist.id}</span>
                <input
                  defaultValue={playlist.name || ""}
                  onBlur={(event) => updatePlaylist(playlist.id, { name: event.target.value })}
                />
                <span>{playlist.user_email || `Utilizator #${playlist.user_id}`}</span>
                <span>{playlist.track_count}</span>
                <label className="toggle-switch" aria-label={`Schimba vizibilitatea publica pentru ${playlist.name}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(playlist.is_public)}
                    onChange={(event) => updatePlaylist(playlist.id, { is_public: event.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
                <span>{playlist.avg_rating || "Indisponibil"}</span>
                <button type="button" className="danger-button" onClick={() => deletePlaylist(playlist.id)}>
                  Sterge
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "feedback" && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <h2>Moderare feedback</h2>
            <span>Verifica ratingurile si comentariile</span>
          </div>
          <div className="admin-table feedback-table">
            <div className="admin-row admin-row-header">
              <span>ID</span>
              <span>Piesa</span>
              <span>Utilizator</span>
              <span>Rating</span>
              <span>Criterii</span>
              <span>Comentariu</span>
              <span>Actiuni</span>
            </div>
            {feedback.map((item) => (
              <div className="admin-row" key={item.id}>
                <span>#{item.id}</span>
                <span>{item.track_title || `Piesa #${item.track_id}`}</span>
                <span>{item.user_email || `Utilizator #${item.user_id}`}</span>
                <span>{item.rating || "Indisponibil"}</span>
                <span>
                  M {item.melody_rating || "-"} / O {item.originality_rating || "-"} / E {item.emotional_impact_rating || "-"} / C {item.commercial_potential_rating || "-"} / P {item.production_quality_rating || "-"}
                </span>
                <span>{item.comment || "Fara comentariu"}</span>
                <button type="button" className="danger-button" onClick={() => deleteFeedback(item.id)}>
                  Sterge
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

    </section>
  );
}

export default AdminPage;

