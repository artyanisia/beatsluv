import React, { useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

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
  const [users, setUsers] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function adminFetch(path, options = {}) {
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
      throw new Error(payload.detail || "Admin request failed");
    }
    return payload;
  }

  async function loadAdminData() {
    setLoading(true);
    setMessage("");
    try {
      const [overviewData, usersData, tracksData, feedbackData] = await Promise.all([
        adminFetch("/admin/overview"),
        adminFetch("/admin/users"),
        adminFetch(`/admin/tracks?limit=120&search=${encodeURIComponent(search)}`),
        adminFetch("/admin/feedback?limit=120"),
      ]);
      setOverview(overviewData);
      setUsers(usersData);
      setTracks(tracksData);
      setFeedback(feedbackData);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId, role) {
    try {
      await adminFetch(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMessage(`Updated user #${userId} role.`);
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
      setMessage(`Updated track #${trackId}.`);
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteTrack(trackId) {
    if (!window.confirm(`Delete track #${trackId} and its feedback?`)) {
      return;
    }
    try {
      await adminFetch(`/admin/tracks/${trackId}`, { method: "DELETE" });
      setMessage(`Deleted track #${trackId}.`);
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteFeedback(feedbackId) {
    if (!window.confirm(`Delete feedback #${feedbackId}?`)) {
      return;
    }
    try {
      await adminFetch(`/admin/feedback/${feedbackId}`, { method: "DELETE" });
      setMessage(`Deleted feedback #${feedbackId}.`);
      await loadAdminData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (user?.role !== "ADMIN" || user?.email !== "admin@gmail.com") {
    return (
      <section className="panel">
        <h2>Admin</h2>
        <p className="empty-state">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="admin-page">
      {message && <div className="status-message">{message}</div>}

      {overview && (
        <div className="stats-grid">
          <AdminStat label="Users" value={overview.users} />
          <AdminStat label="Admins" value={overview.admins} />
          <AdminStat label="Tracks" value={overview.tracks} />
          <AdminStat label="Playable" value={overview.playable_tracks} />
          <AdminStat label="Feedback" value={overview.feedback} />
          <AdminStat label="Requests" value={overview.generation_requests} />
        </div>
      )}

      <div className="admin-toolbar">
        <div className="nav-actions">
          {["tracks", "users", "feedback"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? "nav-button active" : "nav-button"}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <button type="button" onClick={loadAdminData} disabled={loading}>
          {loading ? "Loading..." : "Refresh Admin Data"}
        </button>
      </div>

      {activeTab === "tracks" && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <h2>Track Management</h2>
            <span>Edit status and metadata</span>
          </div>
          <div className="admin-search">
            <input
              value={search}
              placeholder="Search by title, genre, mood"
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="button" onClick={loadAdminData}>Search</button>
          </div>
          <div className="admin-table">
            <div className="admin-row admin-row-header">
              <span>ID</span>
              <span>Title</span>
              <span>Status</span>
              <span>Genre</span>
              <span>Mood</span>
              <span>Tempo</span>
              <span>Rating</span>
              <span>Actions</span>
            </div>
            {tracks.map((track) => (
              <div className="admin-row" key={track.id}>
                <span>#{track.id}</span>
                <span>{track.title}</span>
                <select
                  value={track.status || "COMPLETED"}
                  onChange={(event) => updateTrack(track.id, { status: event.target.value })}
                >
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="FAILED">FAILED</option>
                  <option value="HIDDEN">HIDDEN</option>
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
                <span>{track.avg_rating || "N/A"}</span>
                <button type="button" className="danger-button" onClick={() => deleteTrack(track.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "users" && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <h2>User Management</h2>
            <span>Manage roles</span>
          </div>
          <div className="admin-table users-table">
            <div className="admin-row admin-row-header">
              <span>ID</span>
              <span>Email</span>
              <span>Role</span>
              <span>Tracks</span>
              <span>Feedback</span>
            </div>
            {users.map((account) => (
              <div className="admin-row" key={account.id}>
                <span>#{account.id}</span>
                <span>{account.email}</span>
                <select
                  value={account.role}
                  onChange={(event) => updateUserRole(account.id, event.target.value)}
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                <span>{account.tracks_count}</span>
                <span>{account.feedback_count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === "feedback" && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <h2>Feedback Moderation</h2>
            <span>Review ratings and comments</span>
          </div>
          <div className="admin-table feedback-table">
            <div className="admin-row admin-row-header">
              <span>ID</span>
              <span>Track</span>
              <span>User</span>
              <span>Rating</span>
              <span>Comment</span>
              <span>Actions</span>
            </div>
            {feedback.map((item) => (
              <div className="admin-row" key={item.id}>
                <span>#{item.id}</span>
                <span>{item.track_title || `Track #${item.track_id}`}</span>
                <span>{item.user_email || `User #${item.user_id}`}</span>
                <span>{item.rating || "N/A"}</span>
                <span>{item.comment || "No comment"}</span>
                <button type="button" className="danger-button" onClick={() => deleteFeedback(item.id)}>
                  Delete
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
