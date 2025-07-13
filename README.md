# Mohan Foundation NGO – Awareness Quiz App

An interactive web-based quiz platform developed for **Mohan Foundation**, a leading Indian NGO working to promote awareness about **organ donation**. This platform is designed to educate users, debunk myths, and encourage informed conversations through engaging quizzes.


## 🎯 Purpose

To support the mission of Mohan Foundation by providing a fun, informative, and accessible learning tool that:
- Educates users about the importance of organ donation
- Encourages active participation in awareness campaigns
- Reinforces learning with instant feedback and scoring

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

## 📝 License

This project is licensed under the MIT License.

