# NGO Quiz Application

A real-time live quiz application built with React/TypeScript frontend, Node.js/Express backend, PostgreSQL database, and Socket.io for real-time communication.

## 🚀 Features

- **Real-time Quiz Sessions**: Live quiz sessions with real-time updates
- **Multiple Question Types**: Support for multiple choice, true/false, typed answers, and matching questions
- **Live Analytics**: Real-time analytics and leaderboards
- **Participant Management**: Easy participant joining with access codes
- **Creator Dashboard**: Comprehensive dashboard for quiz creators
- **Responsive Design**: Modern, responsive UI that works on all devices

## 🛠️ Tech Stack

### Frontend

- **React 18** with TypeScript
- **Socket.io Client** for real-time communication
- **Chart.js** for analytics visualization
- **CSS Modules** for styling

### Backend

- **Node.js** with Express
- **Socket.io** for real-time communication
- **PostgreSQL** database
- **JWT** authentication
- **Multer** for file uploads

### Database

- **PostgreSQL** with proper relationships
- **Connection pooling** for performance

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd NGO_quiz
   ```

2. **Install dependencies**

   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Set up environment variables**

   Create `.env` file in the backend directory:

   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=ngo_quiz
   DB_USER=your_username
   DB_PASSWORD=your_password

   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key

   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # File Upload Configuration
   UPLOAD_PATH=./uploads
   MAX_FILE_SIZE=5242880
   ```

4. **Set up the database**

   ```bash
   # Create PostgreSQL database
   createdb ngo_quiz

   # The database tables will be created automatically when you start the server
   ```

5. **Start the application**

   ```bash
   # Start backend server (from backend directory)
   cd backend
   npm run dev

   # Start frontend (from frontend directory, in a new terminal)
   cd frontend
   npm start
   ```

## 📁 Project Structure

```
NGO_quiz/
├── backend/
│   ├── config/
│   │   └── database.js
│   │   └── middleware/
│   │   └── auth.js
│   │   └── routes/
│   │   └── socket/
│   │   └── uploads/
│   │   └── package.json
│   └── server.js
├── frontend/
│   ├── public/
│   │   └── src/
│   │   └── package.json
│   └── README.md
├── .gitignore
└── README.md
```

## 🎯 Usage

### For Quiz Creators

1. **Sign up/Login** at `/login`
2. **Create a new quiz** with questions
3. **Activate the quiz** to generate an access code
4. **Share the access code** with participants
5. **Start the quiz session** and monitor real-time analytics

### For Participants

1. **Enter the access code** at `/join`
2. **Enter your name** to join the quiz
3. **Answer questions** in real-time
4. **View results** and leaderboard

## 🔧 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Quiz Management

- `POST /api/quiz` - Create new quiz
- `GET /api/quiz` - Get all quizzes for creator
- `PUT /api/quiz/:quizId` - Update quiz
- `GET /api/quiz/:quizId` - Get quiz with questions
- `POST /api/quiz/:quizId/questions` - Add question to quiz

### Session Management

- `POST /api/quiz/join` - Join quiz as participant
- `POST /api/quiz/:quizId/sessions` - Create new session
- `GET /api/quiz/session/:sessionId` - Get session info

### Analytics

- `GET /api/quiz/:quizId/analytics/:sessionId` - Get detailed analytics
- `GET /api/quiz/:quizId/stats` - Get quiz statistics

## 🔌 Socket Events

### Client to Server

- `join-quiz` - Join quiz session as participant
- `join-session-creator` - Join session as creator
- `start-quiz` - Start quiz session
- `submit-answer` - Submit answer to question

### Server to Client

- `joined-session` - Confirmation of joining session
- `participant-joined` - New participant joined
- `quiz-started` - Quiz has started
- `next-question` - Next question available
- `question-results` - Results for current question
- `quiz-ended` - Quiz has ended with final leaderboard

## 🗄️ Database Schema

### Tables

- `users` - User accounts
- `quizzes` - Quiz information
- `questions` - Quiz questions
- `quiz_sessions` - Active quiz sessions
- `participants` - Session participants
- `responses` - Participant responses

## 🚀 Deployment

### Backend Deployment

1. Set up PostgreSQL database
2. Configure environment variables
3. Install dependencies: `npm install`
4. Start server: `npm start`

### Frontend Deployment

1. Build the application: `npm run build`
2. Serve the build folder with a web server

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please open an issue in the GitHub repository or contact the development team.

## 🔄 Recent Updates

- Fixed duplicate participant issues
- Improved analytics accuracy
- Enhanced real-time leaderboard functionality
- Added comprehensive error handling
- Improved type safety with TypeScript
