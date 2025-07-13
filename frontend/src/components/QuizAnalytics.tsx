import React, { useState, useEffect } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import axios from 'axios';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface QuestionAnalytics {
  id: number;
  question_text: string;
  question_type: string;
  total_responses: number;
  correct_responses: number;
  average_time: number | string;
  success_rate: number | string;
}

interface ParticipantAnalytics {
  id: number;
  name: string;
  total_score: number;
  questions_answered: number;
  correct_answers: number;
  average_time: number | string;
  joined_at: string;
}

interface QuizAnalyticsProps {
  sessionId: number;
  quizId: number;
}

const QuizAnalytics: React.FC<QuizAnalyticsProps> = ({ sessionId, quizId }) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [sessionId, quizId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/quiz/${quizId}/analytics/${sessionId}`);
      setAnalytics(response.data);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="pulse">Loading Analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-error">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-error">
        <div className="alert alert-error">No analytics data available</div>
      </div>
    );
  }

  const { questions, participants, summary } = analytics;

  // Question Performance Chart
  const questionPerformanceData = {
    labels: questions.map((q: QuestionAnalytics) => `Q${q.id}`),
    datasets: [
      {
        label: 'Success Rate (%)',
        data: questions.map((q: QuestionAnalytics) => {
          const rate = typeof q.success_rate === 'string' ? parseFloat(q.success_rate) : Number(q.success_rate);
          return isNaN(rate) ? 0 : rate;
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Participant Score Distribution
  const scoreDistributionData = {
    labels: ['0-10', '11-20', '21-30', '31-40', '41-50', '50+'],
    datasets: [
      {
        data: [0, 0, 0, 0, 0, 0], // Will be calculated
        backgroundColor: [
          '#ff6384',
          '#36a2eb',
          '#cc65fe',
          '#ffce56',
          '#4bc0c0',
          '#9966ff',
        ],
      },
    ],
  };

  // Calculate score distribution
  const scoreRanges = [0, 11, 21, 31, 41, 51];
  participants.forEach((p: ParticipantAnalytics) => {
    for (let i = 0; i < scoreRanges.length - 1; i++) {
      if (p.total_score >= scoreRanges[i] && p.total_score < scoreRanges[i + 1]) {
        scoreDistributionData.datasets[0].data[i]++;
        break;
      }
    }
    if (p.total_score >= 50) {
      scoreDistributionData.datasets[0].data[5]++;
    }
  });

  // Participant Performance Line Chart
  const participantPerformanceData = {
    labels: participants.map((p: ParticipantAnalytics) => p.name),
    datasets: [
      {
        label: 'Total Score',
        data: participants.map((p: ParticipantAnalytics) => p.total_score),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
    ],
  };

  return (
    <div className="quiz-analytics">
      <div className="analytics-header">
        <h2>Quiz Analytics</h2>
        <p>Detailed performance analysis and insights</p>
      </div>

      {/* Summary Cards */}
      <div className="analytics-summary">
        <div className="summary-card">
          <div className="summary-number">{summary.totalParticipants}</div>
          <div className="summary-label">Total Participants</div>
        </div>
        <div className="summary-card">
          <div className="summary-number">{typeof summary.averageScore === 'string' ? parseFloat(summary.averageScore).toFixed(1) : summary.averageScore.toFixed(1)}</div>
          <div className="summary-label">Average Score</div>
        </div>
        <div className="summary-card">
          <div className="summary-number">{summary.totalQuestions}</div>
          <div className="summary-label">Total Questions</div>
        </div>
        <div className="summary-card">
          <div className="summary-number">{typeof summary.overallSuccessRate === 'string' ? parseFloat(summary.overallSuccessRate).toFixed(1) : summary.overallSuccessRate.toFixed(1)}%</div>
          <div className="summary-label">Success Rate</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="analytics-charts">
        {/* Question Performance */}
        <div className="chart-section">
          <h3>Question Performance</h3>
          <div className="chart-container">
            <Bar 
              data={questionPerformanceData} 
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                  title: {
                    display: true,
                    text: 'Success Rate by Question',
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Score Distribution */}
        <div className="chart-section">
          <h3>Score Distribution</h3>
          <div className="chart-container">
            <Doughnut 
              data={scoreDistributionData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                  title: {
                    display: true,
                    text: 'Participant Score Distribution',
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Participant Performance */}
        <div className="chart-section">
          <h3>Participant Performance</h3>
          <div className="chart-container">
            <Line 
              data={participantPerformanceData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'top' as const,
                  },
                  title: {
                    display: true,
                    text: 'Individual Scores',
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="analytics-tables">
        {/* Question Details */}
        <div className="table-section">
          <h3>Question Details</h3>
          <div className="table-container">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Responses</th>
                  <th>Correct</th>
                  <th>Success Rate</th>
                  <th>Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q: QuestionAnalytics) => (
                  <tr key={q.id}>
                    <td>{q.question_text.substring(0, 50)}...</td>
                    <td>{q.question_type}</td>
                    <td>{q.total_responses}</td>
                    <td>{q.correct_responses}</td>
                    <td>{Number(q.success_rate).toFixed(1)}%</td>
                    <td>{Number(q.average_time || 0).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Participant Details */}
        <div className="table-section">
          <h3>Participant Details</h3>
          <div className="table-container">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Score</th>
                  <th>Questions</th>
                  <th>Correct</th>
                  <th>Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {participants
                  .sort((a: ParticipantAnalytics, b: ParticipantAnalytics) => b.total_score - a.total_score)
                  .map((p: ParticipantAnalytics, index: number) => (
                    <tr key={p.id}>
                      <td>#{index + 1}</td>
                      <td>{p.name}</td>
                      <td>{p.total_score}</td>
                      <td>{p.questions_answered}</td>
                      <td>{p.correct_answers}</td>
                      <td>{Number(p.average_time || 0).toFixed(1)}s</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizAnalytics; 