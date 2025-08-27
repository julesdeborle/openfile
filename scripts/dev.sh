#!/bin/bash
echo "🚀 Starting Chess Learning Platform..."

# Start databases in background
echo "🗄️ Starting databases..."
cd docker
docker-compose up -d postgres redis
echo "⏳ Waiting for databases to start..."
sleep 5

# Start backend in background
echo "🐍 Starting backend..."
cd ../backend
source venv/bin/activate
uvicorn main:app --reload &
BACKEND_PID=$!

# Start frontend in background  
echo "⚛️ Starting frontend..."
cd ../frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ Chess Learning Platform is starting!"
echo "🌐 URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C and cleanup
trap "echo '🛑 Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker-compose -f docker/docker-compose.yml stop postgres redis; exit" INT
wait
