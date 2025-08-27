# Interactive Chess Learning Platform

A modern web application for learning chess through interactive openings, puzzles, and analysis.

## 🚀 Quick Start

### Option 1: Use the development script
```bash
./scripts/dev.sh
```

### Option 2: Manual startup
1. **Start databases:**
   ```bash
   cd docker
   docker-compose up -d postgres redis
   ```

2. **Start backend:** (in new terminal)
   ```bash
   cd backend
   source venv/bin/activate
   uvicorn main:app --reload
   ```

3. **Start frontend:** (in new terminal)
   ```bash
   cd frontend
   npm start
   ```

## 🌐 Access URLs
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000  
- **API Documentation:** http://localhost:8000/docs

## ��️ Project Structure
```
chess/
├── frontend/          # React + TypeScript app
├── backend/           # FastAPI + Python
│   └── venv/         # Python virtual environment
├── docker/            # Database configurations
├── scripts/           # Development scripts
└── docs/              # Documentation
```

## 🛠️ Tech Stack
- **Frontend:** React, TypeScript, TailwindCSS, chess.js
- **Backend:** FastAPI, SQLAlchemy, Python
- **Database:** PostgreSQL, Redis
- **Chess Engine:** python-chess

## 🎯 Next Steps
1. Create your first API endpoint in `backend/`
2. Build chess components in `frontend/src/components/`
3. Set up database models and migrations
4. Implement the chess learning features!

## 📚 Documentation
- FastAPI docs: http://localhost:8000/docs (when running)
- React docs: https://react.dev/
- Chess.js docs: https://github.com/jhlywa/chess.js

Happy coding! 🎮♟️
