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
import showcaseImage from "./assets/vision-showcase.png";
import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";
const COLORS = ["#0075ff", "#01b574", "#00bcff", "#7551ff", "#ffb547", "#e31a5f", "#38bdf8"];

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

const chartAxis = {
  tick: { fill: "#a0aec0", fontSize: 12 },
  axisLine: false,
  tickLine: false,
};

const tooltipStyle = {
  background: "rgba(6, 11, 40, 0.96)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "14px",
  color: "#ffffff",
};

function DashboardIcon({ name }) {
  const icons = {
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    sales: (
      <>
        <line x1="12" x2="12" y1="2" y2="22" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
    star: (
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.86 1.18 6.87L12 17.77 5.82 21 7 14.13l-5-4.86 6.91-1.01L12 2Z" />
    ),
    more: (
      <>
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="svg-icon">
      {icons[name]}
    </svg>
  );
}

function EmptyState({ children }) {
  return <p className="empty-state">{children}</p>;
}

function VisionStatCard({ label, value, icon, change, isPositive = true }) {
  return (
    <div className="stat-card metric-card">
      <div>
        <p className="stat-card-title">{label}</p>
        <div className="stat-card-value">{value}</div>
        <p className={`stat-card-change ${isPositive ? "positive" : "negative"}`}>{change}</p>
      </div>
      <div className="stat-card-icon">
        <DashboardIcon name={icon} />
      </div>
    </div>
  );
}

function ProgressRing({ value, max = 100, label, color = "blue", center }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(value / max, 1));
  const dash = `${progress * circumference} ${circumference}`;

  return (
    <div className="progress-ring-block">
      <div className="progress-ring">
        <svg width="136" height="136" viewBox="0 0 136 136">
          <circle className="progress-ring-bg" cx="68" cy="68" r={radius} fill="none" />
          <circle
            className={`progress-ring-circle ${color}`}
            cx="68"
            cy="68"
            r={radius}
            fill="none"
            strokeDasharray={dash}
            transform="rotate(-90 68 68)"
          />
        </svg>
        <div className={`progress-value ${color}`}>{center}</div>
      </div>
      <div className="progress-label">{label}</div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

const Dashboard = () => {
  const { getAuthHeaders, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChart, setSelectedChart] = useState("");
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
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container glass-card">
        <h2>Error Loading Dashboard</h2>
        <p>{error}</p>
        <button type="button" onClick={loadAllAnalytics}>
          Retry
        </button>
      </div>
    );
  }

  const { overview, genres, moods, tempos, durations, ratings, trends, users, keys, aiPerformance, monthly } = data;
  const ratingPercent = Math.round(((overview?.avg_rating || 0) / 5) * 100);

  return (
    <div className="dashboard">
      {overview && (
        <div className="stats-grid">
          <VisionStatCard
            label="Today's Users"
            value={overview.total_users.toLocaleString()}
            icon="users"
            change="+3% since yesterday"
          />
          <VisionStatCard
            label="Total Sales"
            value={`$${(overview.total_tracks * 103).toLocaleString()}`}
            icon="sales"
            change="+5% than last week"
          />
          <VisionStatCard
            label="Total Tracks"
            value={overview.total_tracks.toLocaleString()}
            icon="music"
            change="+12% this month"
          />
          <VisionStatCard
            label="Avg Rating"
            value={`${overview.avg_rating}/5`}
            icon="star"
            change="+2% better quality"
          />
        </div>
      )}

      <div className="analytics-header">
        <div className="analytics-title">
          <p className="eyebrow">Welcome back, {user?.email?.split('@')[0]?.charAt(0)?.toUpperCase() + user?.email?.split('@')[0]?.slice(1) || 'User'}</p>
          <h1>Music Generation Analytics</h1>
          <p>AI-powered insights from your music creation journey. Explore your data with interactive charts.</p>
        </div>
      </div>

      <div className="analytics-metrics">
        <div className="card compact-card horizontal-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Feedback Tracking</h3>
              <p className="card-subtitle">Live rating health</p>
            </div>
            <button type="button" className="icon-button" aria-label="More options">
              <DashboardIcon name="more" />
            </button>
          </div>
          <div className="card-content">
            <div className="stacked-metrics">
              <div>
                <span>Total Feedback</span>
                <strong>{overview?.total_feedback || 0} reviews</strong>
              </div>
              <div>
                <span>Average Score</span>
                <strong>{overview?.avg_rating || 0}/5</strong>
              </div>
            </div>
            <ProgressRing value={ratingPercent} label="Based on user ratings" center={`${ratingPercent}%`} />
          </div>
        </div>

        <div className="card compact-card horizontal-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">AI Performance</h3>
              <p className="card-subtitle">Model quality score</p>
            </div>
          </div>
          <div className="card-content">
            <ProgressRing value={93} label="Total Score" center="9.3" color="green" />
          </div>
        </div>
      </div>

      <div className="analytics-controls">
        <div className="chart-selector">
          <label htmlFor="chart-select">Select Chart View:</label>
          <select 
            id="chart-select"
            value={selectedChart} 
            onChange={(e) => setSelectedChart(e.target.value)}
            className="chart-dropdown"
          >
            <option value="">Choose a chart view...</option>
            <option value="genres">Genre Analysis</option>
            <option value="ratings">Rating Analytics</option>
            <option value="trends">Time Trends</option>
            <option value="technical">Technical Data</option>
            <option value="users">User Analytics</option>
          </select>
        </div>
      </div>

      {/* Render charts based on selected view */}
      <div className="charts-grid">
        {selectedChart === "genres" && (
          <>
            <ChartCard title="Tracks by Genre">
              {genres.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={genres} dataKey="count" nameKey="genre" outerRadius={102} label>
                      {genres.map((entry, index) => (
                        <Cell key={entry.genre} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No genre data.</EmptyState>
              )}
            </ChartCard>

            <ChartCard title="Tracks by Mood">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={moods}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="mood" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#0075ff" name="Tracks" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Average Tempo by Genre">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={genres}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="genre" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="avg_tempo" fill="#ffb547" name="Avg BPM" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}

        {selectedChart === "technical" && (
          <>
            <ChartCard title="Tempo Distribution">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={tempos}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="tempo_range" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#00bcff" name="Tracks" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Duration Distribution">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={durations}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="duration_range" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#7551ff" name="Tracks" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Key Frequency">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={keys}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="key_signature" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="#01b574" name="Tracks" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="AI Temperature vs Rating">
              {aiPerformance.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={aiPerformance}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="temperature_range" {...chartAxis} />
                    <YAxis domain={[0, 5]} {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="avg_rating" fill="#e31a5f" name="Avg Rating" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No AI performance data yet.</EmptyState>
              )}
            </ChartCard>
          </>
        )}

        {selectedChart === "trends" && (
          <>
            <ChartCard title="Tracks Created Over Time">
              {trends.daily_tracks.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends.daily_tracks}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="date" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="count" stroke="#0075ff" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No recent trend data.</EmptyState>
              )}
            </ChartCard>

            <ChartCard title="Monthly Evolution">
              {monthly.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthly}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="month" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="generated_count" stroke="#0075ff" strokeWidth={3} name="Generations" dot={false} />
                    <Line type="monotone" dataKey="feedback_count" stroke="#01b574" strokeWidth={3} name="Feedback" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No monthly data yet.</EmptyState>
              )}
            </ChartCard>
          </>
        )}

        {selectedChart === "ratings" && (
          <>
            <ChartCard title="Rating Distribution">
              {ratings.rating_distribution.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratings.rating_distribution}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="rating" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="#01b574" name="Feedback" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No feedback ratings yet.</EmptyState>
              )}
            </ChartCard>

            <ChartCard title="Average Rating by Genre">
              {ratings.genre_ratings.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratings.genre_ratings}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="genre" {...chartAxis} />
                    <YAxis domain={[0, 5]} {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="avg_rating" fill="#7551ff" name="Avg Rating" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No rated genres yet.</EmptyState>
              )}
            </ChartCard>
          </>
        )}

        {selectedChart === "users" && (
          <>
            <ChartCard title="Active Users">
              {users.active_users.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={users.active_users.slice(0, 10)}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="user_id" {...chartAxis} />
                    <YAxis {...chartAxis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="tracks_created" fill="#38bdf8" name="Tracks Created" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState>No user activity data yet.</EmptyState>
              )}
            </ChartCard>

            <ChartCard title="User Engagement">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { metric: "Avg Listens", value: users.engagement.avg_listens || 0 },
                  { metric: "Like Rate", value: users.engagement.like_percentage || 0 },
                  { metric: "Download Rate", value: users.engagement.download_percentage || 0 },
                ]}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="metric" {...chartAxis} />
                  <YAxis {...chartAxis} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="#7551ff" name="Value" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}
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
