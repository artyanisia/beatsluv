import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from 'recharts';
import { useAuth } from './AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Colors for charts
const COLORS = ['#1e4d45', '#2d6a5f', '#3c8679', '#4ba393', '#5abfad', '#69dbc7'];

const Dashboard = () => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Analytics data states
  const [overview, setOverview] = useState(null);
  const [genreData, setGenreData] = useState([]);
  const [moodData, setMoodData] = useState([]);
  const [tempoData, setTempoData] = useState([]);
  const [durationData, setDurationData] = useState([]);
  const [ratingData, setRatingData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);

  useEffect(() => {
    loadAllAnalytics();
  }, []);

  const loadAllAnalytics = async () => {
    setLoading(true);
    setError('');
    
    try {
      const headers = {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      };

      const [
        overviewRes,
        genreRes,
        moodRes,
        tempoRes,
        durationRes,
        ratingRes,
        trendsRes,
        userRes
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/analytics/overview`, { headers }),
        fetch(`${API_BASE_URL}/analytics/genre-distribution`, { headers }),
        fetch(`${API_BASE_URL}/analytics/mood-analysis`, { headers }),
        fetch(`${API_BASE_URL}/analytics/tempo-distribution`, { headers }),
        fetch(`${API_BASE_URL}/analytics/duration-analysis`, { headers }),
        fetch(`${API_BASE_URL}/analytics/rating-analysis`, { headers }),
        fetch(`${API_BASE_URL}/analytics/trends-over-time`, { headers }),
        fetch(`${API_BASE_URL}/analytics/user-preferences`, { headers })
      ]);

      if (!overviewRes.ok) throw new Error('Failed to load overview data');
      if (!genreRes.ok) throw new Error('Failed to load genre data');
      if (!moodRes.ok) throw new Error('Failed to load mood data');
      if (!tempoRes.ok) throw new Error('Failed to load tempo data');
      if (!durationRes.ok) throw new Error('Failed to load duration data');
      if (!ratingRes.ok) throw new Error('Failed to load rating data');
      if (!trendsRes.ok) throw new Error('Failed to load trends data');
      if (!userRes.ok) throw new Error('Failed to load user data');

      setOverview(await overviewRes.json());
      setGenreData(await genreRes.json());
      setMoodData(await moodRes.json());
      setTempoData(await tempoRes.json());
      setDurationData(await durationRes.json());
      setRatingData(await ratingRes.json());
      setTrendsData(await trendsRes.json());
      setUserPreferences(await userRes.json());

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">
          <div>Loading Analytics...</div>
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
        <button onClick={loadAllAnalytics}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>BeatsLuv Analytics Dashboard</h1>
        <p>Insights and trends from your generated music</p>
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Tracks</h3>
            <div className="stat-number">{overview.total_tracks}</div>
          </div>
          <div className="stat-card">
            <h3>Total Users</h3>
            <div className="stat-number">{overview.total_users}</div>
          </div>
          <div className="stat-card">
            <h3>Total Feedback</h3>
            <div className="stat-number">{overview.total_feedback}</div>
          </div>
          <div className="stat-card">
            <h3>Average Rating</h3>
            <div className="stat-number">{overview.avg_rating}/5</div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="charts-grid">
        
        {/* Genre Distribution */}
        <div className="chart-card">
          <h3>Genre Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={genreData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                label={({genre, count}) => `${genre}: ${count}`}
              >
                {genreData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, 'Tracks']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Mood Analysis */}
        <div className="chart-card">
          <h3>Mood Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={moodData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mood" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#1e4d45" name="Track Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tempo Distribution */}
        <div className="chart-card">
          <h3>Tempo Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tempoData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tempo_range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#2d6a5f" name="Tracks" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Duration Analysis */}
        <div className="chart-card">
          <h3>Duration Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={durationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="duration_range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3c8679" name="Track Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Rating Distribution */}
        {ratingData && (
          <div className="chart-card">
            <h3>Rating Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ratingData.rating_distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rating" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#4ba393" name="Feedback Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Daily Tracks Trend */}
        {trendsData && trendsData.daily_tracks && trendsData.daily_tracks.length > 0 && (
          <div className="chart-card">
            <h3>Daily Track Creation (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendsData.daily_tracks}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#1e4d45" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Additional insights */}
      <div className="insights-grid">
        
        {/* Recent Tracks */}
        {overview && overview.recent_tracks && overview.recent_tracks.length > 0 && (
          <div className="insight-card">
            <h3>Recent Tracks</h3>
            <div className="recent-tracks-list">
              {overview.recent_tracks.map(track => (
                <div key={track.id} className="recent-track">
                  <strong>{track.title}</strong>
                  <span>{track.genre} • {track.mood}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Genre Ratings */}
        {ratingData && ratingData.genre_ratings && ratingData.genre_ratings.length > 0 && (
          <div className="insight-card">
            <h3>Genre Ratings</h3>
            <div className="genre-ratings-list">
              {ratingData.genre_ratings.map(genre => (
                <div key={genre.genre} className="genre-rating">
                  <span className="genre-name">{genre.genre}</span>
                  <span className="rating-score">{genre.avg_rating}/5</span>
                  <span className="rating-count">({genre.rating_count} ratings)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Engagement */}
        {userPreferences && userPreferences.engagement && (
          <div className="insight-card">
            <h3>User Engagement</h3>
            <div className="engagement-stats">
              <div className="engagement-stat">
                <strong>Average Listens:</strong> {userPreferences.engagement.avg_listens}
              </div>
              <div className="engagement-stat">
                <strong>Like Rate:</strong> {userPreferences.engagement.like_percentage}%
              </div>
              <div className="engagement-stat">
                <strong>Download Rate:</strong> {userPreferences.engagement.download_percentage}%
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-footer">
        <button onClick={loadAllAnalytics} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;