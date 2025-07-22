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
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);

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

  // Define a Chart.js plugin for green/red boxes under x-axis labels
  const getOptionCorrectnessPlugin = (q: any) => ({
    id: 'optionCorrectnessBoxes',
    afterDraw: (chart: any) => {
      const { ctx, chartArea, scales } = chart;
      if (!ctx || !scales.x) return;
      const xAxis = scales.x;
      const yAxis = scales.y;
      const labels = chart.data.labels;
      if (!labels) return;
      // Get correct/incorrect info for each label
      const correctAnswers = q.correct_answers || [];
      labels.forEach((label: any, i: number) => {
        let isCorrect = false;
        if (q.question_type === 'true_false') {
          // Normalize both correctAnswers and label to string 'true'/'false'
          const normLabel = (label === true || label === 'true' || label === 'True') ? 'true' : 'false';
          if (Array.isArray(correctAnswers)) {
            isCorrect = correctAnswers.map((a: any) => (a === true || a === 'true' || a === 'True') ? 'true' : 'false').includes(normLabel);
          } else if (typeof correctAnswers === 'string') {
            const normCorrect = (correctAnswers === 'true' || correctAnswers === 'True') ? 'true' : 'false';
            isCorrect = normCorrect === normLabel;
          }
        } else {
          if (Array.isArray(correctAnswers)) {
            isCorrect = correctAnswers.includes(label) || correctAnswers.includes(label.toString());
          } else if (typeof correctAnswers === 'string') {
            isCorrect = correctAnswers === label || correctAnswers === label.toString();
          }
        }
        // Get x position for this label
        const x = xAxis.getPixelForTick(i);
        const y = yAxis.bottom + 24; // 24px below axis
        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = isCorrect ? '#10b981' : '#ef4444';
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        // Draw rounded rect
        const boxWidth = 32;
        const boxHeight = 18;
        const radius = 8;
        ctx.moveTo(x - boxWidth/2 + radius, y);
        ctx.lineTo(x + boxWidth/2 - radius, y);
        ctx.quadraticCurveTo(x + boxWidth/2, y, x + boxWidth/2, y + radius);
        ctx.lineTo(x + boxWidth/2, y + boxHeight - radius);
        ctx.quadraticCurveTo(x + boxWidth/2, y + boxHeight, x + boxWidth/2 - radius, y + boxHeight);
        ctx.lineTo(x - boxWidth/2 + radius, y + boxHeight);
        ctx.quadraticCurveTo(x - boxWidth/2, y + boxHeight, x - boxWidth/2, y + boxHeight - radius);
        ctx.lineTo(x - boxWidth/2, y + radius);
        ctx.quadraticCurveTo(x - boxWidth/2, y, x - boxWidth/2 + radius, y);
        ctx.closePath();
        ctx.fill();
        // Draw label text
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isCorrect ? 'Correct' : 'Incorrect', x, y + boxHeight/2);
        ctx.restore();
      });
    },
  });

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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: React.ReactNode[] = [];
                  for (const q of questions) {
                    rows.push(
                      <tr key={q.id}>
                        <td>{q.question_text.substring(0, 50)}...</td>
                        <td>{q.question_type}</td>
                        <td>{q.total_responses}</td>
                        <td>{q.correct_responses}</td>
                        <td>{Number(q.success_rate).toFixed(1)}%</td>
                        <td>{Number(q.average_time || 0).toFixed(1)}s</td>
                        <td>
                          <button
                            className="btn btn-sm"
                            onClick={() => setExpandedQuestionId(expandedQuestionId === q.id ? null : q.id)}
                          >
                            {expandedQuestionId === q.id ? 'Hide' : 'View More'}
                          </button>
                        </td>
                      </tr>
                    );
                    if (expandedQuestionId === q.id) {
                      rows.push(
                        <tr key={`expanded-${q.id}`}>
                          <td colSpan={7}>
                            <div style={{ background: '#F5F3FF', borderRadius: 8, padding: 24, margin: '1rem 0' }}>
                              {/* MCQ/True-False: Option Counts Bar Chart */}
                              {(q.question_type === 'multiple_choice_single' || q.question_type === 'multiple_choice_multiple' || q.question_type === 'true_false') && q.breakdown && (
                                <div style={{ marginBottom: 24 }}>
                                  <h4 style={{ marginBottom: 8 }}>Answers per Option</h4>
                                  <Bar
                                    data={{
                                      labels: q.question_type === 'true_false' ? ['True', 'False'] : Object.keys(q.breakdown.option_counts),
                                      datasets: [
                                        {
                                          label: 'Number of Answers',
                                          data: q.question_type === 'true_false'
                                            ? [q.breakdown.option_counts['true'] || 0, q.breakdown.option_counts['false'] || 0]
                                            : Object.values(q.breakdown.option_counts),
                                          backgroundColor: 'rgba(54, 162, 235, 0.8)',
                                          borderColor: 'rgba(54, 162, 235, 1)',
                                          borderWidth: 1,
                                        },
                                      ],
                                    }}
                                    options={{
                                      responsive: true,
                                      plugins: {
                                        legend: { display: false },
                                        title: { display: false },
                                      },
                                      scales: { y: { beginAtZero: true } },
                                    }}
                                    plugins={[getOptionCorrectnessPlugin(q)]}
                                  />
                                </div>
                              )}
                              {/* MCQ/True-False: Success Rate Donut */}
                              {(q.question_type === 'multiple_choice_single' || q.question_type === 'multiple_choice_multiple' || q.question_type === 'true_false') && (
                                <div style={{ marginBottom: 24, maxWidth: 300 }}>
                                  <h4 style={{ marginBottom: 8 }}>Success Rate</h4>
                                  <Doughnut
                                    data={{
                                      labels: ['Correct', 'Incorrect'],
                                      datasets: [
                                        {
                                          data: [q.correct_responses, q.total_responses - q.correct_responses],
                                          backgroundColor: ['#10b981', '#ef4444'],
                                        },
                                      ],
                                    }}
                                    options={{
                                      responsive: true,
                                      plugins: {
                                        legend: { position: 'top' as const },
                                        title: { display: false },
                                      },
                                    }}
                                  />
                                </div>
                              )}
                              {/* Typed Answer: Donut + List */}
                              {q.question_type === 'typed_answer' && q.breakdown && q.breakdown.answer_counts && (
                                <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                                  <div style={{ maxWidth: 300 }}>
                                    <h4 style={{ marginBottom: 8 }}>Correct vs Incorrect</h4>
                                    <Doughnut
                                      data={{
                                        labels: ['Correct', 'Incorrect'],
                                        datasets: [
                                          {
                                            data: [q.correct_responses, q.total_responses - q.correct_responses],
                                            backgroundColor: ['#10b981', '#ef4444'],
                                          },
                                        ],
                                      }}
                                      options={{
                                        responsive: true,
                                        plugins: {
                                          legend: { position: 'top' as const },
                                          title: { display: false },
                                        },
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <h4 style={{ marginBottom: 8 }}>Answers Entered</h4>
                                    <table className="analytics-table" style={{ minWidth: 200 }}>
                                      <thead>
                                        <tr><th>Answer</th><th>Count</th></tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(q.breakdown.answer_counts).map(([ans, count]) => (
                                          <tr key={ans}><td>{ans}</td><td>{String(count)}</td></tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              {q.question_type === 'typed_answer' && q.correct_answers && (
                                <div style={{ marginBottom: 8, fontWeight: 500, color: '#10b981' }}>
                                  Correct Answer{Array.isArray(q.correct_answers) && q.correct_answers.length > 1 ? 's' : ''}: {Array.isArray(q.correct_answers) ? q.correct_answers.join(', ') : q.correct_answers}
                                </div>
                              )}
                              {/* Match: Bar chart for pair correctness and donut for all pairs correct */}
                              {q.question_type === 'match' && q.breakdown && (
                                <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                                  <div style={{ minWidth: 320, maxWidth: 400 }}>
                                    <h4 style={{ marginBottom: 8 }}>Correct Matches per Pair</h4>
                                    <Bar
                                      data={{
                                        labels: Object.keys(q.breakdown.pair_correct_counts || {}),
                                        datasets: [
                                          {
                                            label: 'Users Matched Correctly',
                                            data: Object.values(q.breakdown.pair_correct_counts || {}),
                                            backgroundColor: 'rgba(54, 162, 235, 0.8)',
                                            borderColor: 'rgba(54, 162, 235, 1)',
                                            borderWidth: 1,
                                          },
                                        ],
                                      }}
                                      options={{
                                        responsive: true,
                                        plugins: {
                                          legend: { display: false },
                                          title: { display: false },
                                        },
                                        scales: { y: { beginAtZero: true } },
                                      }}
                                    />
                                  </div>
                                  <div style={{ maxWidth: 300 }}>
                                    <h4 style={{ marginBottom: 8 }}>All Pairs Matched</h4>
                                    <Doughnut
                                      data={{
                                        labels: ['All Correct', 'Not All Correct'],
                                        datasets: [
                                          {
                                            data: [q.breakdown.all_pairs_correct_count, q.total_responses - q.breakdown.all_pairs_correct_count],
                                            backgroundColor: ['#10b981', '#ef4444'],
                                          },
                                        ],
                                      }}
                                      options={{
                                        responsive: true,
                                        plugins: {
                                          legend: { position: 'top' as const },
                                          title: { display: false },
                                        },
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  }
                  return rows;
                })()}
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