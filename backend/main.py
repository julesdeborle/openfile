from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
import chess
import chess.pgn
import jwt
import bcrypt
import httpx
import smtplib
import json
import os
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re

app = FastAPI(
    title="Chess Learning Platform API",
    description="Interactive chess learning backend with user authentication",
    version="1.0.0"
)

# Configuration
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Email configuration (for development, we'll just print to console)
EMAIL_FROM = "noreply@chesslearning.com"
EMAIL_ENABLED = False  # Set to True when you configure real email

# Security
security = HTTPBearer()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Persistent storage using JSON files (replace with real database in production)
USERS_FILE = "users_db.json"
SESSIONS_FILE = "user_sessions.json"

def load_users_db():
    """Load users from JSON file"""
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_users_db(users_db):
    """Save users to JSON file"""
    try:
        with open(USERS_FILE, 'w') as f:
            json.dump(users_db, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving users database: {e}")

def load_sessions():
    """Load sessions from JSON file"""
    if os.path.exists(SESSIONS_FILE):
        try:
            with open(SESSIONS_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_sessions(sessions):
    """Save sessions to JSON file"""
    try:
        with open(SESSIONS_FILE, 'w') as f:
            json.dump(sessions, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving sessions: {e}")

# Load persistent data
users_db = load_users_db()
user_sessions = load_sessions()

# Pydantic models
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    
    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters long')
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username can only contain letters, numbers, and underscores')
        return v
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[0-9!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', v):
            raise ValueError('Password must contain at least one number or symbol')
        return v

class UserLogin(BaseModel):
    username: str
    password: str

class ChessAccountLink(BaseModel):
    platform: str  # "chess.com" or "lichess.org"
    username: str

class User(BaseModel):
    id: str
    username: str
    email: str
    chess_accounts: dict = {}
    created_at: datetime
    games_imported: int = 0
    email_verified: bool = False

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# Utility functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def send_welcome_email(email: str, username: str):
    """Send welcome email to new user"""
    if not EMAIL_ENABLED:
        # For development, just print to console
        print(f"\n📧 EMAIL SENT TO: {email}")
        print(f"Subject: Welcome to Chess Learning Platform!")
        print(f"Dear {username},")
        print(f"Welcome to Chess Learning Platform! Your account has been created successfully.")
        print(f"You can now link your Chess.com and Lichess accounts to analyze your games.")
        print(f"Happy learning!")
        print(f"- Chess Learning Platform Team\n")
        return True
    
    # In production, implement real email sending here
    try:
        # Configure with your SMTP settings
        pass
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None or user_id not in users_db:
            raise HTTPException(status_code=401, detail="Invalid token")
        return users_db[user_id]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Authentication endpoints
@app.post("/api/auth/register", response_model=Token)
async def register_user(user_data: UserCreate):
    """Register a new user"""
    # Check if username or email already exists
    for user in users_db.values():
        if user["username"].lower() == user_data.username.lower():
            raise HTTPException(status_code=400, detail="Username already exists")
        if user["email"].lower() == user_data.email.lower():
            raise HTTPException(status_code=400, detail="Email already exists")
    
    # Create new user
    user_id = f"user_{len(users_db) + 1}"
    hashed_password = hash_password(user_data.password)
    
    user = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password": hashed_password,
        "chess_accounts": {},
        "created_at": datetime.utcnow(),
        "games_imported": 0,
        "email_verified": False
    }
    
    users_db[user_id] = user
    save_users_db(users_db)  # Persist to file
    
    # Send welcome email
    send_welcome_email(user_data.email, user_data.username)
    
    access_token = create_access_token(user_id)
    
    user_response = User(**{k: v for k, v in user.items() if k != "password"})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@app.post("/api/auth/login", response_model=Token)
async def login_user(user_data: UserLogin):
    """Login user"""
    user = None
    for u in users_db.values():
        if u["username"].lower() == user_data.username.lower():
            user = u
            break
    
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(user["id"])
    user_response = User(**{k: v for k, v in user.items() if k != "password"})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@app.get("/api/auth/me", response_model=User)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return User(**{k: v for k, v in current_user.items() if k != "password"})

# Chess account linking endpoints
@app.post("/api/chess-accounts/link")
async def link_chess_account(
    account_data: ChessAccountLink,
    current_user: dict = Depends(get_current_user)
):
    """Link a chess.com or lichess.org account"""
    platform = account_data.platform.lower()
    username = account_data.username.lower()
    
    if platform not in ["chess.com", "lichess.org"]:
        raise HTTPException(status_code=400, detail="Platform must be chess.com or lichess.org")
    
    # Verify the account exists
    try:
        if platform == "chess.com":
            async with httpx.AsyncClient() as client:
                response = await client.get(f"https://api.chess.com/pub/player/{username}")
                if response.status_code != 200:
                    raise HTTPException(status_code=404, detail="Chess.com account not found")
                player_data = response.json()
                
        elif platform == "lichess.org":
            async with httpx.AsyncClient() as client:
                response = await client.get(f"https://lichess.org/api/user/{username}")
                if response.status_code != 200:
                    raise HTTPException(status_code=404, detail="Lichess account not found")
                player_data = response.json()
        
        # Store the linked account
        current_user["chess_accounts"][platform] = {
            "username": username,
            "linked_at": datetime.utcnow(),
            "verified": True,
            "player_data": player_data
        }
        
        # Save to persistent storage
        save_users_db(users_db)
        
        return {
            "success": True,
            "message": f"Successfully linked {platform} account: {username}",
            "account_info": player_data
        }
        
    except httpx.RequestError:
        raise HTTPException(status_code=500, detail="Failed to verify chess account")

@app.get("/api/chess-accounts/games/{platform}")
async def get_chess_games(
    platform: str,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Fetch recent games from linked chess account with improved logic"""
    platform = platform.lower()
    
    if platform not in current_user["chess_accounts"]:
        raise HTTPException(status_code=404, detail=f"No {platform} account linked")
    
    chess_username = current_user["chess_accounts"][platform]["username"]
    
    try:
        if platform == "chess.com":
            return await fetch_chess_com_games(chess_username, limit)
        elif platform == "lichess.org":
            return await fetch_lichess_games(chess_username, limit)
                    
    except httpx.RequestError:
        raise HTTPException(status_code=500, detail="Failed to fetch games from chess platform")

async def fetch_chess_com_games(username: str, limit: int):
    """Fetch Chess.com games across multiple months if needed"""
    all_games = []
    current_date = datetime.utcnow()
    months_checked = 0
    max_months_to_check = 6  # Don't go back more than 6 months
    
    async with httpx.AsyncClient() as client:
        while len(all_games) < limit and months_checked < max_months_to_check:
            year_month = f"{current_date.year}/{current_date.month:02d}"
            
            try:
                print(f"Fetching Chess.com games for {username} from {year_month}")
                response = await client.get(
                    f"https://api.chess.com/pub/player/{username}/games/{year_month}",
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    games_data = response.json()
                    month_games = games_data.get("games", [])
                    print(f"Found {len(month_games)} games in {year_month}")
                    
                    # Add games from this month
                    all_games.extend(month_games)
                    
                    # If we got no games this month and we already have some games, stop
                    if len(month_games) == 0 and len(all_games) > 0:
                        break
                        
                elif response.status_code == 404:
                    print(f"No games found for {year_month}")
                    # Continue to previous month
                else:
                    print(f"Error fetching {year_month}: {response.status_code}")
                    
            except httpx.TimeoutException:
                print(f"Timeout fetching games for {year_month}")
            except Exception as e:
                print(f"Error fetching games for {year_month}: {e}")
            
            # Go to previous month
            if current_date.month == 1:
                current_date = current_date.replace(year=current_date.year - 1, month=12)
            else:
                current_date = current_date.replace(month=current_date.month - 1)
            
            months_checked += 1
    
    # Sort games by end_time (newest first) and limit
    all_games.sort(key=lambda x: x.get("end_time", 0), reverse=True)
    limited_games = all_games[:limit]
    
    # Process games for easier frontend consumption
    processed_games = []
    for game in limited_games:
        processed_games.append({
            "id": game.get("uuid"),
            "white": game.get("white", {}).get("username"),
            "black": game.get("black", {}).get("username"),
            "result": game.get("white", {}).get("result"),
            "time_control": game.get("time_control"),
            "end_time": game.get("end_time"),
            "pgn": game.get("pgn"),
            "url": game.get("url"),
            "time_class": game.get("time_class"),
            "white": {
                "username": game.get("white", {}).get("username"),
                "rating": game.get("white", {}).get("rating")
            },
            "black": {
                "username": game.get("black", {}).get("username"),
                "rating": game.get("black", {}).get("rating")
            }
        })
    
    return {
        "platform": "chess.com",
        "username": username,
        "games": processed_games,
        "total_found": len(processed_games),
        "requested": limit,
        "months_checked": months_checked,
        "message": f"Found {len(processed_games)} games across {months_checked} months"
    }

async def fetch_lichess_games(username: str, limit: int):
    """Fetch Lichess games with improved error handling"""
    async with httpx.AsyncClient() as client:
        try:
            print(f"Fetching Lichess games for {username}, limit: {limit}")
            response = await client.get(
                f"https://lichess.org/api/games/user/{username}",
                headers={"Accept": "application/x-ndjson"},
                params={"max": limit, "pgnInJson": "true"},
                timeout=15.0
            )
            
            if response.status_code == 200:
                # Lichess returns NDJSON
                games = []
                for line in response.text.strip().split('\n'):
                    if line.strip():
                        try:
                            games.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
                
                processed_games = []
                for game in games:
                    white_player = game.get("players", {}).get("white", {})
                    black_player = game.get("players", {}).get("black", {})
                    
                    processed_games.append({
                        "id": game.get("id"),
                        "white": white_player.get("user", {}).get("name"),
                        "black": black_player.get("user", {}).get("name"),
                        "result": game.get("status"),
                        "time_control": f"{game.get('clock', {}).get('initial', 0)}+{game.get('clock', {}).get('increment', 0)}",
                        "end_time": game.get("lastMoveAt", 0) // 1000,  # Convert to seconds
                        "moves": game.get("moves"),
                        "url": f"https://lichess.org/{game.get('id')}",
                        "pgn": game.get("pgn", ""),
                        "white": {
                            "username": white_player.get("user", {}).get("name"),
                            "rating": white_player.get("rating")
                        },
                        "black": {
                            "username": black_player.get("user", {}).get("name"),
                            "rating": black_player.get("rating")
                        }
                    })
                
                return {
                    "platform": "lichess.org",
                    "username": username,
                    "games": processed_games,
                    "total_found": len(processed_games),
                    "requested": limit,
                    "message": f"Found {len(processed_games)} games"
                }
            else:
                raise HTTPException(status_code=response.status_code, detail=f"Lichess API error: {response.status_code}")
                
        except httpx.TimeoutException:
            raise HTTPException(status_code=408, detail="Timeout fetching games from Lichess")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error fetching Lichess games: {str(e)}")

    return {"games": [], "message": "No games found"}

@app.delete("/api/chess-accounts/unlink/{platform}")
async def unlink_chess_account(
    platform: str,
    current_user: dict = Depends(get_current_user)
):
    """Unlink a chess account"""
    platform = platform.lower()
    
    if platform not in current_user["chess_accounts"]:
        raise HTTPException(status_code=404, detail=f"No {platform} account linked")
    
    del current_user["chess_accounts"][platform]
    save_users_db(users_db)  # Persist changes
    
    return {
        "success": True,
        "message": f"Successfully unlinked {platform} account"
    }

# Debug endpoint to view users (remove in production)
@app.get("/api/debug/users")
async def get_all_users():
    """Debug endpoint to view all users (remove in production)"""
    return {
        "total_users": len(users_db),
        "users": [
            {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "created_at": user["created_at"],
                "chess_accounts": list(user.get("chess_accounts", {}).keys()),
                "games_imported": user.get("games_imported", 0)
            }
            for user in users_db.values()
        ]
    }

# Existing chess endpoints
@app.get("/")
async def root():
    return {
        "message": "Chess Learning Platform API", 
        "version": "1.0.0",
        "status": "running",
        "features": ["authentication", "chess_account_linking", "game_analysis", "email_notifications"]
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "chess_lib": "available", "users_count": len(users_db)}

@app.get("/api/chess/new-game")
async def new_game():
    """Start a new chess game"""
    board = chess.Board()
    return {
        "fen": board.fen(),
        "turn": "white" if board.turn else "black",
        "legal_moves": [move.uci() for move in board.legal_moves][:10],
        "game_over": board.is_game_over()
    }

@app.post("/api/chess/make-move")
async def make_move(move_data: dict):
    """Make a move on the chess board"""
    try:
        board = chess.Board(move_data.get("fen"))
        move = chess.Move.from_uci(move_data.get("move"))
        
        if move in board.legal_moves:
            board.push(move)
            return {
                "success": True,
                "fen": board.fen(),
                "turn": "white" if board.turn else "black",
                "legal_moves": [move.uci() for move in board.legal_moves][:10],
                "game_over": board.is_game_over(),
                "move_san": board.san(move)
            }
        else:
            return {"success": False, "error": "Illegal move"}
    except Exception as e:
        return {"success": False, "error": str(e)}