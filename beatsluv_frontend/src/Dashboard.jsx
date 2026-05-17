import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";
const COLORS = ["#1e4d45", "#c55338", "#d99a4e", "#496a8f", "#7f5a83", "#52796f", "#8a6f3d"];

const ENDPOINTS = {
  overview: "/analytics/overview",
  genres: "/analytics/genre-distribution",
  moods: "/analytics/mood-analysis",
  tempos: "/analytics/tempo-distribution",
  durations: "/analytics/duration-analysis",
  ratings: "/analytics/rating-analysis",
  trends: "/analytics/trends-over-time",
  users: "/analytics/user-preferences",
  keys: "/analytics/key-distribution",
  aiPerformance: "/analytics/ai-performance",
  monthly: "/analytics/monthly-evolution",
};

function EmptyState({ children }) {
  return <p className="empty-state">{children}</p>;
}

function StatCard({ label, value, suffix = "" }) {
  return (
    <div className="stat-card">
      <h3>{label}</h3>
      <div className="stat-number">
        {value}
        {suffix}
      </div>
    </div>
  );
}

const Dashboard = () => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    overview: null,
    genres: [],
    moods: [],
    tempos: [],
    durations: [],
    ratings: { rating_distribution: [], genre_ratings: [] },
    trends: { daily_tracks: [], genre_trends: [] },
    users: { active_users: [], engagement: {} },
    keys: [],
    aiPerformance: [],
    monthly: [],
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
    loadAllAnalytics();
  }, []);

  async function fetchAnalytics(key, path, headers) {
    const response = await fetch(`${API_BASE_URL}${path}`, { headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.detail || `Failed to load ${key}`);
    }
    return [key, payload];
  }

  async function loadAllAnalytics() {
    setLoading(true);
    setError("");

    try {
      const headers = {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      };

      const results = await Promise.all(
        Object.entries(ENDPOINTS).map(([key, path]) => fetchAnalytics(key, path, headers)),
      );

      setData((current) => ({
        ...current,
        ...Object.fromEntries(results),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  function updatePredictionField(field, value) {
    setPredictionForm((current) => ({ ...current, [field]: value }));
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div>Loading analytics...</div>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error Loading Dashboard</h2>
        <p>{error}</p>
        <button type="button" onClick={loadAllAnalytics}>
          Retry
        </button>
      </div>
    );
  }

  const { overview, genres, moods, tempos, durations, ratings, trends, users, keys, aiPerformance, monthly } = data;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Track Analytics</h1>
        <p>SQL statistics calculated from saved tracks, users, and feedback.</p>
      </div>

      {overview && (
        <div className="stats-grid">
          <StatCard label="Tracks" value={overview.total_tracks} />
          <StatCard label="Playable" value={overview.playable_tracks} />
          <StatCard label="Users" value={overview.total_users} />
          <StatCard label="Avg Duration" value={overview.avg_duration} suffix="s" />
          <StatCard label="Feedback" value={overview.total_feedback} />
          <StatCard label="Avg Rating" value={overview.avg_rating} suffix="/5" />
        </div>
      )}

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Tracks by Genre</h3>
          {genres.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={genres} dataKey="count" nameKey="genre" outerRadius={100} label>
                  {genres.map((entry, index) => (
                    <Cell key={entry.genre} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No genre data.</EmptyState>
          )}
        </div>

        <div className="chart-card">
          <h3>Tracks by Mood</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={moods}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mood" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#1e4d45" name="Tracks" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Tempo Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tempos}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tempo_range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#496a8f" name="Tracks" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Duration Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={durations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="duration_range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#c55338" name="Tracks" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Key Frequency</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={keys}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="key_signature" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8a6f3d" name="Tracks" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Average Tempo by Genre</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={genres}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="genre" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avg_tempo" fill="#d99a4e" name="Avg BPM" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Tracks Created Over Time</h3>
          {trends.daily_tracks.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends.daily_tracks}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#1e4d45" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No recent trend data.</EmptyState>
          )}
        </div>

        <div className="chart-card">
          <h3>Rating Distribution</h3>
          {ratings.rating_distribution.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ratings.rating_distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rating" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#52796f" name="Feedback" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No feedback ratings yet.</EmptyState>
          )}
        </div>

        <div className="chart-card">
          <h3>Average Rating by Genre</h3>
          {ratings.genre_ratings.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ratings.genre_ratings}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="genre" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="avg_rating" fill="#7f5a83" name="Avg Rating" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No rated genres yet.</EmptyState>
          )}
        </div>

        <div className="chart-card">
          <h3>AI Temperature vs Rating</h3>
          {aiPerformance.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={aiPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="temperature_range" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avg_rating" fill="#c55338" name="Avg Rating" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No AI performance data yet.</EmptyState>
          )}
        </div>

        <div className="chart-card">
          <h3>Monthly Evolution</h3>
          {monthly.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="generated_count" stroke="#1e4d45" strokeWidth={2} name="Generations" />
                <Line type="monotone" dataKey="feedback_count" stroke="#c55338" strokeWidth={2} name="Feedback" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState>No monthly data yet.</EmptyState>
          )}
        </div>
      </div>

      <div className="insights-grid">
        <form className="insight-card" onSubmit={handlePredictionSubmit}>
          <h3>Popularity Prediction</h3>
          <div className="form-grid compact-form">
            <label>
              Genre
              <input
                value={predictionForm.genre}
                onChange={(event) => updatePredictionField("genre", event.target.value)}
              />
            </label>
            <label>
              Mood
              <input
                value={predictionForm.mood}
                onChange={(event) => updatePredictionField("mood", event.target.value)}
              />
            </label>
            <label>
              Key
              <input
                value={predictionForm.key_signature}
                onChange={(event) => updatePredictionField("key_signature", event.target.value)}
              />
            </label>
            <label>
              Tempo
              <input
                type="number"
                value={predictionForm.tempo}
                onChange={(event) => updatePredictionField("tempo", event.target.value)}
              />
            </label>
            <label>
              Duration
              <input
                type="number"
                value={predictionForm.duration_seconds}
                onChange={(event) => updatePredictionField("duration_seconds", event.target.value)}
              />
            </label>
            <label>
              Temperature
              <input
                type="number"
                step="0.01"
                min="0"
                max="2"
                value={predictionForm.ai_temperature}
                onChange={(event) => updatePredictionField("ai_temperature", event.target.value)}
              />
            </label>
          </div>
          <button type="submit">Predict Rating</button>
          {prediction && (
            <div className="prediction-result">
              <strong>Estimated popularity: {prediction.predicted_rating}/5</strong>
              <span>
                {prediction.model_name} / {prediction.training_samples} training samples
              </span>
            </div>
          )}
          {predictionError && <p className="empty-state">{predictionError}</p>}
        </form>

        <div className="insight-card">
          <h3>Recent Tracks</h3>
          {overview?.recent_tracks?.length ? (
            <div className="recent-tracks-list">
              {overview.recent_tracks.map((track) => (
                <div key={track.id} className="recent-track">
                  <strong>{track.title}</strong>
                  <span>
                    {track.genre} / {track.mood} / {track.tempo || "N/A"} BPM / {track.duration_seconds}s
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No tracks yet.</EmptyState>
          )}
        </div>

        <div className="insight-card">
          <h3>Top Users</h3>
          {users.active_users.length ? (
            <div className="genre-ratings-list">
              {users.active_users.map((user) => (
                <div key={user.user_id} className="genre-rating">
                  <span className="genre-name">User #{user.user_id}</span>
                  <span>{user.tracks_created} tracks</span>
                  <span className="rating-count">{user.feedback_given} feedback</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No user activity yet.</EmptyState>
          )}
        </div>

        <div className="insight-card">
          <h3>Engagement</h3>
          <div className="engagement-stats">
            <div className="engagement-stat">
              <strong>Average listens</strong>
              <span>{users.engagement.avg_listens || 0}</span>
            </div>
            <div className="engagement-stat">
              <strong>Like rate</strong>
              <span>{users.engagement.like_percentage || 0}%</span>
            </div>
            <div className="engagement-stat">
              <strong>Download rate</strong>
              <span>{users.engagement.download_percentage || 0}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-footer">
        <button type="button" onClick={loadAllAnalytics} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
