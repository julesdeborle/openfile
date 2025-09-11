// Replace your App.tsx with this version that includes page persistence:

import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import type { PieceDropHandlerArgs } from 'react-chessboard';
import { Chess } from 'chess.js';
import { AuthModal } from './components/AuthModal';
import { AccountSettings } from './components/AccountSettings';
import { GameAnalysis } from './components/GameAnalysis';
import './App.css';

// Navigation tabs
const tabs = [
  { id: 'play', label: '♟️ Play', icon: '🎮' },
  { id: 'openings', label: '📚 Openings', icon: '🔍' },
  { id: 'puzzles', label: '🧩 Puzzles', icon: '🎯' },
  { id: 'analysis', label: '📊 Analysis', icon: '🔬' },
  { id: 'account', label: '👤 Account', icon: '⚙️' }
];

function App() {
  const [game, setGame] = useState(new Chess());
  const [position, setPosition] = useState(game.fen());
  const [activeTab, setActiveTab] = useState('play');
  const [moveError, setMoveError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState('🔄 Connecting...');
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check for existing authentication and page state on app load
  useEffect(() => {
    // Restore authentication state
    const savedToken = localStorage.getItem('chess_token');
    const savedUser = localStorage.getItem('chess_user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }

    // Restore active tab from localStorage
    const savedTab = localStorage.getItem('chess_active_tab');
    if (savedTab && tabs.find(tab => tab.id === savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  // Save active tab whenever it changes
  useEffect(() => {
    localStorage.setItem('chess_active_tab', activeTab);
  }, [activeTab]);

  // Test API connection
  useEffect(() => {
    fetch('http://localhost:8000/')
      .then(res => res.json())
      .then(data => setApiStatus(`✅ ${data.message}`))
      .catch(() => setApiStatus('❌ Backend offline'));
  }, []);

  const handleLogin = (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
      localStorage.removeItem('chess_token');
      localStorage.removeItem('chess_user');
    localStorage.removeItem('chess_active_tab'); // Clear saved tab on logout
      setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setActiveTab('play');
  };

  const handleUpdateUser = async (updatedUser: any) => {
    setUser(updatedUser);
    localStorage.setItem('chess_user', JSON.stringify(updatedUser));
  };

  const makeMove = (sourceSquare: string, targetSquare: string) => {
    try {
      setMoveError(null);
      
      const gameCopy = new Chess();
      gameCopy.loadPgn(game.pgn());
      
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });

      if (move === null) {
        setMoveError(`Illegal move: ${sourceSquare} to ${targetSquare}`);
        return false;
      }

      setGame(gameCopy);
      setPosition(gameCopy.fen());
      
      setTimeout(() => setMoveError(null), 3000);
      return true;
    } catch (error) {
      setMoveError(`Move error: ${error}`);
      console.error('Move error:', error);
      return false;
    }
  };

  const onDrop = ({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
    if (!targetSquare) return false;
    return makeMove(sourceSquare, targetSquare);
  };

  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setPosition(newGame.fen());
    setMoveError(null);
  };

  const undoMove = () => {
    try {
      const history = game.history();
      if (history.length === 0) return;
      
      const newGame = new Chess();
      const newHistory = history.slice(0, -1);
      
      newHistory.forEach(move => {
        newGame.move(move);
      });
      
      setGame(newGame);
      setPosition(newGame.fen());
      setMoveError(null);
    } catch (error) {
      setMoveError('Error undoing move');
    }
  };

  const testApiCall = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/chess/new-game');
      const data = await response.json();
      console.log('API Response:', data);
      alert('✅ API working! Check console for response.');
    } catch (error) {
      alert('❌ API call failed. Make sure backend is running!');
    }
  };

  const renderPlayTab = () => (
    <div className="tab-content">
      <div className="chess-section">
        <div className="board-container">
          <Chessboard 
            options={{
              position: position,
              onPieceDrop: onDrop,
              allowDragging: true,
              boardOrientation: 'white',
              showNotation: true,
              animationDurationInMs: 300
            }}
          />
        </div>
        
        <div className="game-controls">
          <div className="control-buttons">
            <button onClick={resetGame} className="btn btn-primary">
              🔄 New Game
            </button>
            <button onClick={undoMove} className="btn btn-secondary" disabled={game.history().length === 0}>
              ↶ Undo Move
            </button>
            <button onClick={testApiCall} className="btn btn-accent">
              🧪 Test API
            </button>
          </div>
          
          {moveError && (
            <div className="error-message">
              ⚠️ {moveError}
            </div>
          )}
        </div>
      </div>

      <div className="game-info">
        <div className="info-card">
          <h3>Game Status</h3>
          <div className="status-grid">
            <div className="status-item">
              <span className="label">Turn:</span>
              <span className={`turn ${game.turn() === 'w' ? 'white' : 'black'}`}>
                {game.turn() === 'w' ? '⚪ White' : '⚫ Black'}
              </span>
            </div>
            <div className="status-item">
              <span className="label">Move:</span>
              <span>#{Math.floor(game.history().length / 2) + 1}</span>
            </div>
            <div className="status-item">
              <span className="label">Status:</span>
              <span className={game.inCheck() ? 'check' : 'normal'}>
                {game.inCheck() ? '🔴 Check!' : game.isGameOver() ? '🏁 Game Over' : '✅ Playing'}
              </span>
            </div>
          </div>
        </div>

        <div className="info-card">
          <h3>Move History</h3>
          <div className="move-history">
            {game.history().length === 0 ? (
              <p className="no-moves">No moves yet</p>
            ) : (
              <div className="moves-grid">
                {game.history().map((move, index) => (
                  <span key={index} className="move-chip">
                    {Math.floor(index / 2) + 1}{index % 2 === 0 ? '.' : '...'} {move}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderOpeningsTab = () => (
    <div className="tab-content">
      <div className="coming-soon">
        <h2>📚 Openings Explorer</h2>
        <p>Coming soon! This will feature:</p>
        <ul>
          <li>🔍 Interactive opening explorer</li>
          <li>📊 Move statistics and popularity</li>
          <li>🎯 Opening recommendations</li>
          <li>📖 Theory and explanations</li>
        </ul>
      </div>
    </div>
  );

  const renderPuzzlesTab = () => (
    <div className="tab-content">
      <div className="coming-soon">
        <h2>🧩 Puzzle Trainer</h2>
        <p>Coming soon! This will feature:</p>
        <ul>
          <li>🎯 Daily puzzles</li>
          <li>⭐ Rating system</li>
          <li>🔥 Streak tracking</li>
          <li>📈 Progress analytics</li>
        </ul>
      </div>
    </div>
  );

  const renderAnalysisTab = () => {
    if (!isAuthenticated) {
      return (
        <div className="tab-content">
          <div className="auth-prompt">
            <h2>📊 Analysis Requires Account</h2>
            <p>Please login or create an account to analyze your chess games.</p>
            <button onClick={() => setShowAuthModal(true)} className="btn btn-primary">
              🔐 Login / Sign Up
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="tab-content">
        <GameAnalysis user={user} token={token!} />
      </div>
    );
  };

  const renderAccountTab = () => {
    if (!isAuthenticated) {
      return (
        <div className="tab-content">
          <div className="auth-prompt">
            <h2>👤 Account Required</h2>
            <p>Please login or create an account to access account settings and link your chess accounts.</p>
            <button onClick={() => setShowAuthModal(true)} className="btn btn-primary">
              🔐 Login / Sign Up
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="tab-content">
        <AccountSettings 
          user={user} 
          token={token!} 
          onUpdateUser={handleUpdateUser}
        />
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'play': return renderPlayTab();
      case 'openings': return renderOpeningsTab();
      case 'puzzles': return renderPuzzlesTab();
      case 'analysis': return renderAnalysisTab();
      case 'account': return renderAccountTab();
      default: return renderPlayTab();
    }
  };

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-content">
          <div className="app-title">
            <img src="/openFile.png" alt="Chess Logo" className="app-logo" />
            <h1>
              {/* <span className="chess-icon">♔</span> */}
              OpenFile
              {/* <span className="chess-icon">♛</span> */}
            </h1>
          </div>
          <div className="header-actions">
            <div className="api-status">
              {apiStatus}
            </div>
            {isAuthenticated ? (
              <div className="user-menu">
                <span className="welcome-text">Welcome, {user?.username}!</span>
                <button onClick={handleLogout} className="btn btn-secondary btn-small">
                  🚪 Logout
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAuthModal(true)} className="btn btn-primary btn-small">
                🔐 Login
              </button>
            )}
          </div>
        </div>
        
        <nav className="tab-navigation">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <main className="app-main">
        {renderTabContent()}
      </main>

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
      />
    </div>
  );
}

export default App;