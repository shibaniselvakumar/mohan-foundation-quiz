import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

interface Question {
  id?: number;
  question_text: string;
  question_type: 'multiple_choice_single' | 'multiple_choice_multiple' | 'true_false' | 'typed_answer' | 'match';
  options?: string[];
  correct_answers: string[] | string | boolean;
  time_limit: number;
  points: number;
  negative_points: number;
  image_url?: string;
  order_index: number;
}

interface Quiz {
  id: number;
  title: string;
  description: string;
  access_code: string;
  status: string;
}

const QuizCreator: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  console.log('QuizCreator component rendered', { 
    quizId, 
    currentPath: window.location.pathname,
    isCreateMode: window.location.pathname === '/quiz/create'
  });

  const [questionForm, setQuestionForm] = useState<Question>({
    question_text: '',
    question_type: 'multiple_choice_single',
    options: [''],
    correct_answers: [],
    time_limit: 30,
    points: 1,
    negative_points: 0,
    order_index: 0
  });

  const fetchQuiz = async () => {
    console.log('fetchQuiz called for quizId:', quizId);
    try {
      const response = await axios.get(`/api/quiz/${quizId}`);
      console.log('Quiz fetched successfully:', response.data);
      setQuiz(response.data.quiz);
      setQuestions(response.data.questions);
    } catch (error: any) {
      console.error('fetchQuiz error:', error);
      console.error('Error response:', error.response?.data);
      setError(error.response?.data?.error || 'Failed to fetch quiz');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('QuizCreator useEffect triggered', { quizId });
    if (quizId && quizId !== 'create') {
      console.log('Fetching existing quiz:', quizId);
      fetchQuiz();
    } else {
      console.log('Initializing new quiz creation');
      setQuiz({
        id: 0,
        title: '',
        description: '',
        access_code: '',
        status: 'draft'
      });
      setLoading(false);
    }
  }, [quizId]);

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Quiz submit started', { quizId, quiz });
    if (!quiz) {
      console.log('No quiz data, returning');
      return;
    }

    setSaving(true);
    try {
      if (quizId === 'create' || window.location.pathname === '/quiz/create') {
        console.log('Creating new quiz with data:', { title: quiz.title, description: quiz.description });
        const response = await axios.post('/api/quiz', {
          title: quiz.title,
          description: quiz.description
        });
        console.log('Quiz created successfully:', response.data);
        console.log('Navigating to:', `/quiz/${response.data.quiz.id}`);
        navigate(`/quiz/${response.data.quiz.id}`);
      } else {
        console.log('Updating existing quiz:', quizId);
        await axios.put(`/api/quiz/${quizId}`, {
          title: quiz.title,
          description: quiz.description
        });
        console.log('Quiz updated successfully');
      }
    } catch (error: any) {
      console.error('Quiz submit error:', error);
      console.error('Error response:', error.response?.data);
      setError(error.response?.data?.error || 'Failed to save quiz');
    } finally {
      setSaving(false);
    }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Question submit started', { quizId, questionForm });
    if (!quizId || quizId === 'create' || window.location.pathname === '/quiz/create') {
      console.log('No valid quizId for question submission, returning');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('questionText', questionForm.question_text);
      formData.append('questionType', questionForm.question_type);
      formData.append('options', JSON.stringify(questionForm.options));
      formData.append('correctAnswers', JSON.stringify(questionForm.correct_answers));
      formData.append('timeLimit', questionForm.time_limit.toString());
      formData.append('points', questionForm.points.toString());
      formData.append('negativePoints', questionForm.negative_points.toString());

      console.log('Submitting question with formData:', {
        questionText: questionForm.question_text,
        questionType: questionForm.question_type,
        options: questionForm.options,
        correctAnswers: questionForm.correct_answers,
        timeLimit: questionForm.time_limit,
        points: questionForm.points,
        negativePoints: questionForm.negative_points
      });

      // Additional debug logging for multiple choice questions
      if (questionForm.question_type === 'multiple_choice_single' || questionForm.question_type === 'multiple_choice_multiple') {
        console.log('Multiple choice question details:', {
          options: questionForm.options,
          correctAnswers: questionForm.correct_answers,
          optionsJSON: JSON.stringify(questionForm.options),
          correctAnswersJSON: JSON.stringify(questionForm.correct_answers)
        });
      }

      if (editingQuestion?.id) {
        console.log('Updating existing question:', editingQuestion.id);
        await axios.put(`/api/quiz/${quizId}/questions/${editingQuestion.id}`, formData);
      } else {
        console.log('Creating new question for quiz:', quizId);
        await axios.post(`/api/quiz/${quizId}/questions`, formData);
      }

      console.log('Question saved successfully, fetching updated quiz');
      fetchQuiz();
      resetQuestionForm();
    } catch (error: any) {
      console.error('Question submit error:', error);
      console.error('Error response:', error.response?.data);
      setError(error.response?.data?.error || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      question_text: '',
      question_type: 'multiple_choice_single',
      options: [''],
      correct_answers: [],
      time_limit: 30,
      points: 1,
      negative_points: 0,
      order_index: 0
    });
    setEditingQuestion(null);
    setShowQuestionForm(false);
  };

  const editQuestion = (question: Question) => {
    setQuestionForm({
      ...question,
      options: question.options || [''],
      correct_answers: question.correct_answers
    });
    setEditingQuestion(question);
    setShowQuestionForm(true);
  };

  const deleteQuestion = async (questionId: number) => {
    if (!quizId || quizId === 'create' || window.location.pathname === '/quiz/create') return;

    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await axios.delete(`/api/quiz/${quizId}/questions/${questionId}`);
        fetchQuiz();
      } catch (error: any) {
        setError(error.response?.data?.error || 'Failed to delete question');
      }
    }
  };

  const updateQuestionForm = (field: keyof Question, value: any) => {
    setQuestionForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addOption = () => {
    setQuestionForm(prev => ({
      ...prev,
      options: [...(prev.options || []), '']
    }));
  };

  const removeOption = (index: number) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index) || []
    }));
  };

  const updateOption = (index: number, value: string) => {
    setQuestionForm(prev => ({
      ...prev,
      options: prev.options?.map((opt, i) => i === index ? value : opt) || []
    }));
  };

  const isValidQuestion = () => {
    // Check if question text is provided
    if (!questionForm.question_text.trim()) return false;

    // Check if correct answer is selected based on question type
    switch (questionForm.question_type) {
      case 'multiple_choice_single':
        return Array.isArray(questionForm.correct_answers) && 
               questionForm.correct_answers.length === 1 && 
               questionForm.correct_answers[0] !== '';
      
      case 'multiple_choice_multiple':
        return Array.isArray(questionForm.correct_answers) && 
               questionForm.correct_answers.length > 0;
      
      case 'true_false':
        return typeof questionForm.correct_answers === 'boolean';
      
      case 'typed_answer':
      case 'match':
        return typeof questionForm.correct_answers === 'string' && 
               questionForm.correct_answers.trim() !== '';
      
      default:
        return false;
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'multiple_choice_single': return 'Multiple Choice (Single Answer)';
      case 'multiple_choice_multiple': return 'Multiple Choice (Multiple Answers)';
      case 'true_false': return 'True/False';
      case 'typed_answer': return 'Typed Answer';
      case 'match': return 'Match';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
          <div className="text-center">
            <div className="pulse" style={{ fontSize: '2rem', color: 'var(--primary-blue)' }}>Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-creator-container">
      <div className="quiz-header">
        <div className="header-accent-bar" />
        <h1 className="quiz-title">Quiz Creator</h1>
        <p className="quiz-subtitle">Build and customize your quiz</p>
      </div>
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: 'var(--gray-800)',
              marginBottom: '0.5rem'
            }}>
              {quizId === 'create' ? 'Create New Quiz' : 'Edit Quiz'}
            </h1>
            <p style={{
              fontSize: '1.125rem',
              color: 'var(--gray-600)'
            }}>
              {quizId === 'create' ? 'Build your interactive quiz' : 'Modify your quiz questions and settings'}
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-outline"
          >
            Back to Dashboard
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {/* Quiz Details Form */}
        <div className="card mb-6">
          <div className="card-header">
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'var(--gray-800)'
            }}>
              Quiz Details
            </h2>
          </div>

          <form onSubmit={handleQuizSubmit}>
            <div className="form-group">
              <label htmlFor="title" className="form-label">Quiz Title</label>
              <input
                type="text"
                id="title"
                value={quiz?.title || ''}
                onChange={(e) => setQuiz(prev => prev ? { ...prev, title: e.target.value } : { id: 0, title: e.target.value, description: '', access_code: '', status: 'draft' })}
                className="form-input"
                placeholder="Enter quiz title"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">Description (Optional)</label>
              <textarea
                id="description"
                value={quiz?.description || ''}
                onChange={(e) => setQuiz(prev => prev ? { ...prev, description: e.target.value } : { id: 0, title: '', description: e.target.value, access_code: '', status: 'draft' })}
                className="form-input form-textarea"
                placeholder="Enter quiz description"
                disabled={saving}
              />
            </div>

            {quiz?.access_code && (
              <div className="form-group">
                <label className="form-label">Access Code</label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <code style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--gray-100)',
                    borderRadius: '0.5rem',
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: 'var(--primary-blue)',
                    letterSpacing: '0.25rem'
                  }}>
                    {quiz.access_code}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(quiz.access_code)}
                    className="btn btn-outline btn-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Quiz Status and Actions */}
            {quiz && quiz.id > 0 && (
              <div className="form-group">
                <label className="form-label">Quiz Status</label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <span style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    backgroundColor: quiz.status === 'active' ? 'var(--success-color)' + '20' : 'var(--warning-color)' + '20',
                    color: quiz.status === 'active' ? 'var(--success-color)' : 'var(--warning-color)'
                  }}>
                    {quiz.status === 'active' ? 'Active' : 'Draft'}
                  </span>
                  {quiz.status === 'draft' && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await axios.put(`/api/quiz/${quiz.id}`, { status: 'active' });
                          fetchQuiz();
                        } catch (error: any) {
                          setError(error.response?.data?.error || 'Failed to activate quiz');
                        }
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      Activate Quiz
                    </button>
                  )}
                  {quiz.status === 'active' && (
                    <Link
                      to={`/session/${quiz.id}`}
                      className="btn btn-success btn-sm"
                    >
                      Start Session
                    </Link>
                  )}
                </div>
              </div>
            )}

            {(() => {
              console.log('Quiz form state:', { 
                quiz, 
                quizTitle: quiz?.title, 
                saving, 
                buttonDisabled: saving || !quiz?.title?.trim(),
                buttonText: saving ? 'Saving...' : (quizId === 'create' || window.location.pathname === '/quiz/create' ? 'Create Quiz' : 'Save Changes')
              });
              return null;
            })()}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !quiz?.title?.trim()}
              onClick={() => console.log('Create Quiz button clicked', { saving, quizTitle: quiz?.title, isDisabled: saving || !quiz?.title?.trim() })}
            >
              {saving ? 'Saving...' : (quizId === 'create' || window.location.pathname === '/quiz/create' ? 'Create Quiz' : 'Save Changes')}
            </button>
          </form>
        </div>

        {/* Questions Section */}
        {(quizId && quizId !== 'create' && quiz && quiz.id > 0 && window.location.pathname !== '/quiz/create') && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: 'var(--gray-800)'
              }}>
                Questions ({questions.length})
              </h2>
              <button
                onClick={() => {
                  console.log('Add Question button clicked');
                  setShowQuestionForm(true);
                }}
                className="btn btn-primary"
              >
                Add Question
              </button>
            </div>

            {/* Question Form */}
            {showQuestionForm && quizId && quizId !== 'create' && window.location.pathname !== '/quiz/create' && (
              (() => { console.log('Question form rendered'); return null; })(),
              <div className="card mb-6">
                <div className="card-header">
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: 'var(--gray-800)'
                  }}>
                    {editingQuestion ? 'Edit Question' : 'Add New Question'}
                  </h3>
                </div>

                <form onSubmit={(e) => { console.log('Question form submitted'); handleQuestionSubmit(e); }}>
                  <div className="form-group">
                    <label htmlFor="questionText" className="form-label">Question Text</label>
                    <textarea
                      id="questionText"
                      value={questionForm.question_text}
                      onChange={(e) => updateQuestionForm('question_text', e.target.value)}
                      className="form-input form-textarea"
                      placeholder="Enter your question"
                      required
                      disabled={saving}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="questionType" className="form-label">Question Type</label>
                    <select
                      id="questionType"
                      value={questionForm.question_type}
                      onChange={(e) => {
                        const newType = e.target.value as Question['question_type'];
                        updateQuestionForm('question_type', newType);
                        
                        // Reset correct answers based on new question type
                        switch (newType) {
                          case 'multiple_choice_single':
                          case 'multiple_choice_multiple':
                            updateQuestionForm('correct_answers', []);
                            break;
                          case 'true_false':
                            updateQuestionForm('correct_answers', false);
                            break;
                          case 'typed_answer':
                          case 'match':
                            updateQuestionForm('correct_answers', '');
                            break;
                        }
                      }}
                      className="form-input"
                      disabled={saving}
                    >
                      <option value="multiple_choice_single">Multiple Choice (Single Answer)</option>
                      <option value="multiple_choice_multiple">Multiple Choice (Multiple Answers)</option>
                      <option value="true_false">True/False</option>
                      <option value="typed_answer">Typed Answer</option>
                      <option value="match">Match</option>
                    </select>
                  </div>

                  {/* Options for multiple choice questions */}
                  {(questionForm.question_type === 'multiple_choice_single' || 
                    questionForm.question_type === 'multiple_choice_multiple') && (
                    <div className="form-group">
                      <label className="form-label">Options</label>
                      {questionForm.options?.map((option, index) => (
                        <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(index, e.target.value)}
                            className="form-input"
                            placeholder={`Option ${index + 1}`}
                            required
                            disabled={saving}
                          />
                          {/* Correct answer selection */}
                          {questionForm.question_type === 'multiple_choice_single' ? (
                            <input
                              type="radio"
                              name="correctAnswer"
                              checked={Array.isArray(questionForm.correct_answers) && (questionForm.correct_answers as string[]).includes(option)}
                              onChange={() => updateQuestionForm('correct_answers', [option])}
                              disabled={saving}
                            />
                          ) : (
                            <input
                              type="checkbox"
                              checked={Array.isArray(questionForm.correct_answers) && (questionForm.correct_answers as string[]).includes(option)}
                              onChange={(e) => {
                                const currentAnswers = Array.isArray(questionForm.correct_answers) ? questionForm.correct_answers as string[] : [];
                                if (e.target.checked) {
                                  updateQuestionForm('correct_answers', [...currentAnswers, option]);
                                } else {
                                  updateQuestionForm('correct_answers', currentAnswers.filter((ans: string) => ans !== option));
                                }
                              }}
                              disabled={saving}
                            />
                          )}
                          <span style={{ fontSize: '0.875rem', color: 'var(--gray-600)', minWidth: '80px' }}>
                            {questionForm.question_type === 'multiple_choice_single' ? 'Correct' : 'Correct'}
                          </span>
                          {questionForm.options && questionForm.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(index)}
                              className="btn btn-secondary btn-sm"
                              disabled={saving}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addOption}
                        className="btn btn-outline btn-sm"
                        disabled={saving}
                      >
                        Add Option
                      </button>
                    </div>
                  )}

                  {/* Correct answer for true/false questions */}
                  {questionForm.question_type === 'true_false' && (
                    <div className="form-group">
                      <label className="form-label">Correct Answer</label>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="radio"
                            name="trueFalseAnswer"
                            value="true"
                            checked={questionForm.correct_answers === true}
                            onChange={() => updateQuestionForm('correct_answers', true)}
                            disabled={saving}
                          />
                          True
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="radio"
                            name="trueFalseAnswer"
                            value="false"
                            checked={questionForm.correct_answers === false}
                            onChange={() => updateQuestionForm('correct_answers', false)}
                            disabled={saving}
                          />
                          False
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Correct answer for typed answer questions */}
                  {questionForm.question_type === 'typed_answer' && (
                    <div className="form-group">
                      <label htmlFor="correctAnswer" className="form-label">Correct Answer</label>
                      <input
                        type="text"
                        id="correctAnswer"
                        value={typeof questionForm.correct_answers === 'string' ? questionForm.correct_answers : ''}
                        onChange={(e) => updateQuestionForm('correct_answers', e.target.value)}
                        className="form-input"
                        placeholder="Enter the correct answer"
                        required
                        disabled={saving}
                      />
                      <small style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                        Note: Answers will be compared case-insensitively
                      </small>
                    </div>
                  )}

                  {/* Correct answer for match questions */}
                  {questionForm.question_type === 'match' && (
                    <div className="form-group">
                      <label className="form-label">Correct Answer</label>
                      <input
                        type="text"
                        value={typeof questionForm.correct_answers === 'string' ? questionForm.correct_answers : ''}
                        onChange={(e) => updateQuestionForm('correct_answers', e.target.value)}
                        className="form-input"
                        placeholder="Enter the correct matching answer"
                        required
                        disabled={saving}
                      />
                      <small style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                        Enter the answer that participants should match
                      </small>
                    </div>
                  )}

                  {/* Validation message */}
                  {questionForm.question_text && !isValidQuestion() && (
                    <div className="alert alert-error">
                      Please select a correct answer for this question type.
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="timeLimit" className="form-label">Time Limit (seconds)</label>
                    <input
                      type="number"
                      id="timeLimit"
                      value={questionForm.time_limit}
                      onChange={(e) => updateQuestionForm('time_limit', parseInt(e.target.value))}
                      className="form-input"
                      min="5"
                      max="300"
                      required
                      disabled={saving}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label htmlFor="points" className="form-label">Points for Correct Answer</label>
                      <input
                        type="number"
                        id="points"
                        value={questionForm.points}
                        onChange={(e) => updateQuestionForm('points', parseInt(e.target.value))}
                        className="form-input"
                        min="1"
                        required
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="negativePoints" className="form-label">Points for Wrong Answer</label>
                      <input
                        type="number"
                        id="negativePoints"
                        value={questionForm.negative_points}
                        onChange={(e) => updateQuestionForm('negative_points', parseInt(e.target.value))}
                        className="form-input"
                        min="0"
                        required
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving || !questionForm.question_text || !isValidQuestion()}
                    >
                      {saving ? 'Saving...' : (editingQuestion ? 'Update Question' : 'Add Question')}
                    </button>
                    <button
                      type="button"
                      onClick={resetQuestionForm}
                      className="btn btn-outline"
                      disabled={saving}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question.id || index} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 style={{
                      fontSize: '1.125rem',
                      fontWeight: '600',
                      color: 'var(--gray-800)'
                    }}>
                      Question {index + 1}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => editQuestion(question)}
                        className="btn btn-outline btn-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => question.id && deleteQuestion(question.id)}
                        className="btn btn-secondary btn-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <p style={{
                    color: 'var(--gray-700)',
                    marginBottom: '1rem'
                  }}>
                    {question.question_text}
                  </p>

                  <div style={{
                    display: 'flex',
                    gap: '1rem',
                    fontSize: '0.875rem',
                    color: 'var(--gray-600)'
                  }}>
                    <span>Type: {getQuestionTypeLabel(question.question_type)}</span>
                    <span>Time: {question.time_limit}s</span>
                    <span>Points: +{question.points} / -{question.negative_points}</span>
                  </div>
                </div>
              ))}

              {questions.length === 0 && (
                <div className="card text-center">
                  <div style={{
                    fontSize: '3rem',
                    color: 'var(--gray-400)',
                    marginBottom: '1rem'
                  }}>
                    ❓
                  </div>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    color: 'var(--gray-700)',
                    marginBottom: '0.5rem'
                  }}>
                    No questions yet
                  </h3>
                  <p style={{
                    color: 'var(--gray-600)',
                    marginBottom: '1.5rem'
                  }}>
                    Add your first question to get started
                  </p>
                  <button
                    onClick={() => setShowQuestionForm(true)}
                    className="btn btn-primary"
                  >
                    Add First Question
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Show message when no quiz exists yet */}
        {(!quizId || quizId === 'create' || !quiz || quiz.id === 0 || window.location.pathname === '/quiz/create') && (
          <div className="card text-center">
            <div style={{
              fontSize: '3rem',
              color: 'var(--gray-400)',
              marginBottom: '1rem'
            }}>
              📝
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'var(--gray-700)',
              marginBottom: '0.5rem'
            }}>
              Create your quiz first
            </h3>
            <p style={{
              color: 'var(--gray-600)',
              marginBottom: '1.5rem'
            }}>
              Enter a title and description above, then click "Create Quiz" to start adding questions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizCreator; 