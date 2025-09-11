import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import type { PieceDropHandlerArgs } from 'react-chessboard';
import { Chess } from 'chess.js';

interface Game {
  id: string;
  white: string;
  black: string;
  result: string;               // normalized result: '1-0' | '0-1' | '1/2-1/2' | 'unknown'
  raw_result?: string;         // any raw result/status string from API or PGN
  white_result?: string;       // Chess.com style: game.white.result (e.g. 'win','resigned', etc.)
  black_result?: string;       // Chess.com style: game.black.result
  time_control: string;
  end_time: number;
  url: string;
  pgn?: string;
  time_class?: string;
  eco?: string;
  white_rating?: number;
  black_rating?: number;
  user_color?: 'white' | 'black';
  termination?: string;
  opening_name?: string;
  moves?: string[];
  winner?: 'white' | 'black' | 'draw' | 'unknown';
}

interface GameAnalysisProps {
  user: any;
  token: string;
}

interface FilterOptions {
  timeClass: string;
  result: string;
  color: string;
  search: string;
}

export function GameAnalysis({ user, token }: GameAnalysisProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [gameLimit, setGameLimit] = useState(50);
  const [filters, setFilters] = useState<FilterOptions>({
    timeClass: 'all',
    result: 'all',
    color: 'all',
    search: ''
  });
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [showGameModal, setShowGameModal] = useState(false);
  
  // Chess board state for analysis
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [gameToAnalyze, setGameToAnalyze] = useState<Chess | null>(null);
  const [boardPosition, setBoardPosition] = useState('start');
  const [gameHistory, setGameHistory] = useState<string[]>([]);
  const [fetchInfo, setFetchInfo] = useState<{
    requested: number;
    found: number;
    message: string;
  } | null>(null);

  const platforms = Object.keys(user.chess_accounts || {});

  useEffect(() => {
    if (platforms.length > 0 && !selectedPlatform) {
      setSelectedPlatform(platforms[0]);
    }
  }, [platforms, selectedPlatform]);

  useEffect(() => {
    applyFilters();
  }, [games, filters]);

  const fetchGames = async () => {
    if (!selectedPlatform) return;
    
    setLoading(true);
    try {
      // First, test if our token works by calling /me
      console.log('Testing authentication...');
      const authTest = await fetch('http://localhost:8000/api/auth/me', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!authTest.ok) {
        throw new Error(`Authentication failed: ${authTest.status} - ${await authTest.text()}`);
      }
      
      const userData = await authTest.json();
      console.log('Authentication successful, user:', userData);
      
      // Now try to fetch games
      console.log('Fetching games for platform:', selectedPlatform);
      const response = await fetch(
        `http://localhost:8000/api/chess-accounts/games/${selectedPlatform}?limit=${gameLimit}`,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Games fetch response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Games fetch error:', errorData);
        throw new Error(`Failed to fetch games: ${response.status} - ${errorData}`);
      }
      
      const data = await response.json();
      console.log('Games fetched successfully:', data);
      
      // Store fetch information for display
      setFetchInfo({
        requested: data.requested || gameLimit,
        found: data.total_found || data.games?.length || 0,
        message: data.message || `Found ${data.games?.length || 0} games`
      });
      
      const processedGames = processGamesData(data.games, data.username);
      setGames(processedGames);
    } catch (err: any) { // TODO use a more specific error type if available
      console.error('Error in fetchGames:', err);
      alert(`Error: ${err.message}\n\nCheck the browser console for more details.`);
    } finally {
      setLoading(false);
    }
  };

  const processGamesData = (rawGames: any[], username: string): Game[] => {
    return rawGames.map((game, index) => {
      // Normalize names
      const whiteName =
        typeof game.white === 'string'
          ? game.white
          : (game.white && (game.white.username || game.white.user?.name)) || 'Unknown';
      const blackName =
        typeof game.black === 'string'
          ? game.black
          : (game.black && (game.black.username || game.black.user?.name)) || 'Unknown';
  
      const isUserWhite = whiteName.toLowerCase() === username.toLowerCase();
      const userColor = isUserWhite ? 'white' : 'black';
  
      // Try to get Chess.com style results from game.white.result / game.black.result
      const whiteRes =
        typeof game.white === 'object' && game.white?.result
          ? String(game.white.result).toLowerCase()
          : (String((game as any).white_result || '')).toLowerCase();
  
      const blackRes =
        typeof game.black === 'object' && game.black?.result
          ? String(game.black.result).toLowerCase()
          : (String((game as any).black_result || '')).toLowerCase();
  
      // Top-level / PGN fallback
      const topLevel = String(game.result || game.status || '').toLowerCase();
      const pgn = game.pgn || '';
  
      // Determine winner/draw from multiple sources
      let winner: 'white' | 'black' | 'draw' | 'unknown' = 'unknown';
  
      // Check PGN tag if available
      const pgnResultMatch = (pgn.match(/\[Result "([^"]+)"\]/) || [])[1];
      if (pgnResultMatch === '1-0') winner = 'white';
      else if (pgnResultMatch === '0-1') winner = 'black';
      else if (pgnResultMatch === '1/2-1/2') winner = 'draw';
  
      // If still unknown, check chess.com style fields
      if (winner === 'unknown') {
        if (whiteRes && (whiteRes === 'win' || whiteRes.includes('win'))) winner = 'white';
        else if (blackRes && (blackRes === 'win' || blackRes.includes('win'))) winner = 'black';
        else {
          // top-level fields (lichess) or result strings like '1-0'
          if (topLevel.includes('1-0')) winner = 'white';
          else if (topLevel.includes('0-1')) winner = 'black';
          else if (topLevel.includes('draw') || topLevel.includes('stalemate') || topLevel.includes('agreement') || topLevel === '1/2-1/2') winner = 'draw';
        }
      }
  
      const normalizedResult = winner === 'white' ? '1-0' : winner === 'black' ? '0-1' : winner === 'draw' ? '1/2-1/2' : 'unknown';
  
      return {
        id: game.id || game.uuid || `game_${index}`,
        white: whiteName,
        black: blackName,
        result: normalizedResult,
        raw_result: topLevel || '',
        white_result: whiteRes || '',
        black_result: blackRes || '',
        time_control: game.time_control || '0',
        end_time: game.end_time || Math.floor(Date.now() / 1000),
        url: game.url || '',
        pgn: pgn || '',
        time_class: game.time_class || classifyTimeControl(game.time_control),
        eco: extractECOFromPGN(pgn) || game.eco || '',
        white_rating: (typeof game.white === 'object' ? (game.white?.rating || game.white?.user?.rating) : (game.white_rating || 0)) || 0,
        black_rating: (typeof game.black === 'object' ? (game.black?.rating || game.black?.user?.rating) : (game.black_rating || 0)) || 0,
        user_color: userColor,
        termination: extractTerminationFromPGN(pgn),
        opening_name: extractOpeningFromPGN(pgn),
        moves: extractMovesFromPGN(pgn),
        winner: winner
      } as Game;
    });
  };

  const classifyTimeControl = (timeControl: string): string => {
    const time = parseInt(timeControl) || 0;
    if (time < 180) return 'bullet';
    if (time < 600) return 'blitz';
    if (time < 1800) return 'rapid';
    return 'classical';
  };

  const extractECOFromPGN = (pgn?: string): string => {
    if (!pgn) return '';
    const ecoMatch = pgn.match(/\[ECO "([^"]+)"\]/);
    return ecoMatch ? ecoMatch[1] : '';
  };

  const extractTerminationFromPGN = (pgn?: string): string => {
    if (!pgn) return '';
    const termMatch = pgn.match(/\[Termination "([^"]+)"\]/);
    return termMatch ? termMatch[1] : '';
  };

  const extractOpeningFromPGN = (pgn?: string): string => {
    if (!pgn) return '';
    const eventMatch = pgn.match(/\[Event "([^"]+)"\]/);
    return eventMatch ? eventMatch[1] : '';
  };

  const extractMovesFromPGN = (pgn?: string): string[] => {
    if (!pgn) return [];
    try {
      const chess = new Chess();
      const moves: string[] = [];
      
      // Extract just the moves part from PGN
      const movesSection = pgn.split('\n\n')[1];
      if (!movesSection) return [];
      
      // Remove move numbers, comments, and result
      const cleanMoves = movesSection
        .replace(/\d+\./g, '') // Remove move numbers
        .replace(/\{[^}]*\}/g, '') // Remove comments
        .replace(/\[[^\]]*\]/g, '') // Remove clock times
        .replace(/1-0|0-1|1\/2-1\/2|\*/g, '') // Remove result
        .trim()
        .split(/\s+/)
        .filter(move => move && !move.match(/^\d/));

      for (const moveStr of cleanMoves) {
        try {
          const move = chess.move(moveStr);
          if (move) {
            moves.push(move.san);
          }
        } catch (e) {
          break; // Stop on invalid move
        }
      }
      
      return moves;
    } catch (e) {
      return [];
    }
  };

  const applyFilters = () => {
    let filtered = [...games];

    // Apply filters
    if (filters.timeClass !== 'all') {
      filtered = filtered.filter(game => game.time_class === filters.timeClass);
    }

    if (filters.result !== 'all') {
      filtered = filtered.filter(game => {
        if (filters.result === 'wins') return (game.user_color === 'white' && game.result === '1-0') || (game.user_color === 'black' && game.result === '0-1');
        if (filters.result === 'losses') return (game.user_color === 'white' && game.result === '0-1') || (game.user_color === 'black' && game.result === '1-0');
        if (filters.result === 'draws') return game.result === '1/2-1/2';
        return true;
      });
    }

    if (filters.color !== 'all') {
      filtered = filtered.filter(game => game.user_color === filters.color);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(game => 
        game.white.toLowerCase().includes(searchLower) ||
        game.black.toLowerCase().includes(searchLower) ||
        (game.eco && game.eco.toLowerCase().includes(searchLower)) ||
        (game.opening_name && game.opening_name.toLowerCase().includes(searchLower))
      );
    }

    setFilteredGames(filtered);
  };

  const getGameStats = () => {
    const wins = filteredGames.filter(game => game.winner === game.user_color).length;
    const losses = filteredGames.filter(game => game.winner && game.winner !== game.user_color).length;
    const draws = filteredGames.filter(game => !game.winner).length;
  
    const winRate = filteredGames.length > 0 ? ((wins / filteredGames.length) * 100).toFixed(1) : '0';
  
    return { wins, losses, draws, winRate, total: filteredGames.length };
  };

  const handleGameClick = (game: Game) => {
    setSelectedGame(game);
    
    if (game.moves && game.moves.length > 0) {
      const chess = new Chess();
      setGameToAnalyze(chess);
      setGameHistory(game.moves);
      setCurrentMoveIndex(0);
      setBoardPosition(chess.fen());
      setShowGameModal(true);
    } else {
      alert('No moves available for this game');
    }
  };

  const navigateToMove = (moveIndex: number) => {
    if (!gameToAnalyze || !gameHistory) return;
    
    const chess = new Chess();
    
    // Play moves up to the specified index
    for (let i = 0; i <= moveIndex && i < gameHistory.length; i++) {
      try {
        chess.move(gameHistory[i]);
      } catch (e) {
        console.error('Invalid move:', gameHistory[i]);
        break;
      }
    }
    
    setCurrentMoveIndex(moveIndex);
    setBoardPosition(chess.fen());
  };

  const goToNextMove = () => {
    if (currentMoveIndex < gameHistory.length - 1) {
      navigateToMove(currentMoveIndex + 1);
    }
  };

  const goToPreviousMove = () => {
    if (currentMoveIndex >= 0) {
      navigateToMove(currentMoveIndex - 1);
    }
  };

  const goToStart = () => {
    navigateToMove(-1);
  };

  const goToEnd = () => {
    navigateToMove(gameHistory.length - 1);
  };

  const clearGames = () => {
    setGames([]);
    setFilteredGames([]);
    setFetchInfo(null);
  };

  const getResultIcon = (game: Game) => {
    if (game.winner === game.user_color) return { icon: '🟢', text: 'Win' };
    if (game.winner && game.winner !== game.user_color) return { icon: '🔴', text: 'Loss' };
    return { icon: '🟡', text: 'Draw' };
  };

  const getTimeClassIcon = (timeClass: string) => {
    switch (timeClass) {
      case 'bullet': return '⚡';
      case 'blitz': return '🔥';
      case 'rapid': return '⏰';
      case 'classical': return '🎯';
      default: return '♟️';
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const stats = getGameStats();

  if (platforms.length === 0) {
    return (
      <div className="game-analysis">
        <div className="no-accounts-state">
          <div className="no-accounts-icon">🔗</div>
          <h2>No Chess Accounts Linked</h2>
          <p>Link your Chess.com or Lichess account in Account Settings to analyze your games!</p>
          <div className="no-accounts-actions">
            <span className="instruction">Go to</span>
            <span className="tab-highlight">👤 Account</span>
            <span className="instruction">→ Link Chess Account</span>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#64748b' }}>
            <p>Debug info:</p>
            <p>User object: {JSON.stringify(user, null, 2)}</p>
            <p>Chess accounts: {JSON.stringify(user?.chess_accounts, null, 2)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-analysis">
      {/* Header Section */}
      <div className="analysis-header">
        <div className="header-title">
          <h1>📊 Game Analysis</h1>
          <p>Analyze your chess games with an interactive board and move navigation</p>
        </div>
        
        <div className="fetch-controls">
          <div className="platform-selector">
            <label>Platform:</label>
            <select 
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
            >
              {platforms.map(platform => (
                <option key={platform} value={platform}>
                  {platform === 'chess.com' ? '♔' : '♛'} {platform} ({user.chess_accounts[platform].username})
                </option>
              ))}
            </select>
          </div>
          
          <div className="limit-selector">
            <label>Games:</label>
            <select 
              value={gameLimit}
              onChange={(e) => setGameLimit(Number(e.target.value))}
            >
              <option value={10}>Last 10</option>
              <option value={25}>Last 25</option>
              <option value={50}>Last 50</option>
              <option value={100}>Last 100</option>
            </select>
          </div>
          
          <div className="fetch-buttons">
            <button 
              onClick={fetchGames} 
              disabled={loading} 
              className="btn btn-primary fetch-btn"
            >
              {loading ? '🔄 Fetching...' : '📥 Fetch Games'}
            </button>
            
            {games.length > 0 && (
              <button 
                onClick={clearGames} 
                className="btn btn-secondary clear-btn"
              >
                🗑️ Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {games.length > 0 && (
        <>
          {/* Statistics Cards */}
          <div className="stats-section">
            {/* Fetch Info Banner */}
            {fetchInfo && (
              <div className="fetch-info-banner">
                <div className="fetch-info-content">
                  <span className="fetch-icon">📊</span>
                  <div className="fetch-details">
                    <strong>
                      Found {fetchInfo.found} of {fetchInfo.requested} requested games
                    </strong>
                    <p>{fetchInfo.message}</p>
                  </div>
                 </div>
                  {fetchInfo.found < fetchInfo.requested && (
                    <div className="fetch-warning">
                      <span className="warning-icon">⚠️</span>
                      <span>Fewer games found than requested</span>
                    </div>
                  )}
                </div>
            )}
            </div>
            
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Games Analyzed</div>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat-card wins">
              <div className="stat-icon">🟢</div>
              <div className="stat-content">
                <div className="stat-value">{stats.wins}</div>
                <div className="stat-label">Wins</div>
              </div>
            </div>
            <div className="stat-card losses">
              <div className="stat-icon">🔴</div>
              <div className="stat-content">
                <div className="stat-value">{stats.losses}</div>
                <div className="stat-label">Losses</div>
              </div>
            </div>
            <div className="stat-card draws">
              <div className="stat-icon">🟡</div>
              <div className="stat-content">
                <div className="stat-value">{stats.draws}</div>
                <div className="stat-label">Draws</div>
              </div>
            </div>
            <div className="stat-card win-rate">
              <div className="stat-icon">📈</div>
              <div className="stat-content">
                <div className="stat-value">{stats.winRate}%</div>
                <div className="stat-label">Win Rate</div>
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="filters-section">
            <div className="search-filter">
              <input
                type="text"
                placeholder="🔍 Search by player, opening, or ECO code..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="search-input"
              />
            </div>
            
            <div className="filter-controls">
              <select 
                value={filters.timeClass}
                onChange={(e) => setFilters(prev => ({ ...prev, timeClass: e.target.value }))}
                className="filter-select"
              >
                <option value="all">All Time Controls</option>
                <option value="bullet">⚡ Bullet</option>
                <option value="blitz">🔥 Blitz</option>
                <option value="rapid">⏰ Rapid</option>
                <option value="classical">🎯 Classical</option>
              </select>

              <select 
                value={filters.result}
                onChange={(e) => setFilters(prev => ({ ...prev, result: e.target.value }))}
                className="filter-select"
              >
                <option value="all">All Results</option>
                <option value="wins">🟢 Wins</option>
                <option value="losses">🔴 Losses</option>
                <option value="draws">🟡 Draws</option>
              </select>

              <select 
                value={filters.color}
                onChange={(e) => setFilters(prev => ({ ...prev, color: e.target.value }))}
                className="filter-select"
              >
                <option value="all">All Colors</option>
                <option value="white">⚪ White</option>
                <option value="black">⚫ Black</option>
              </select>
            </div>
          </div>

          {/* Games Table */}
          <div className="games-table-container">
            <div className="games-table">
              <div className="table-header">
                <div className="col-result">Result</div>
                <div className="col-players">Players</div>
                <div className="col-ratings">Ratings</div>
                <div className="col-time">Time</div>
                <div className="col-opening">Opening</div>
                <div className="col-date">Date</div>
                <div className="col-actions">Actions</div>
              </div>
              
              <div className="table-body">
                {filteredGames.map((game) => {
                  const result = getResultIcon(game);
                  const opponentName = game.user_color === 'white' ? game.black : game.white;
                  
                  return (
                    <div 
                      key={game.id} 
                      className="game-row"
                      onClick={() => handleGameClick(game)}
                    >
                      <div className="col-result">
                        <div className="result-indicator">
                          <span className="result-icon">{result.icon}</span>
                          <span className="result-text">{result.text}</span>
                        </div>
                        <div className="user-color">
                          {game.user_color === 'white' ? '⚪' : '⚫'}
                        </div>
                      </div>
                      
                      <div className="col-players">
                        <div className="player-info">
                          <span className="you-label">You</span>
                          <span className="vs">vs</span>
                          <span className="opponent">{opponentName}</span>
                        </div>
                      </div>
                      
                      <div className="col-ratings">
                        <span className="user-rating">
                          {game.user_color === 'white' ? (game.white_rating || 0) : (game.black_rating || 0)}
                        </span>
                        <span className="rating-separator">|</span>
                        <span className="opponent-rating">
                          {game.user_color === 'white' ? (game.black_rating || 0) : (game.white_rating || 0)}
                        </span>
                      </div>
                      
                      <div className="col-time">
                        <div className="time-info">
                          <span className="time-icon">{getTimeClassIcon(game.time_class || 'unknown')}</span>
                          <span className="time-text">{Math.floor(parseInt(game.time_control || '0') / 60)}min</span>
                        </div>
                      </div>
                      
                      <div className="col-opening">
                        <span className="eco-code">{game.eco || 'Unknown'}</span>
                      </div>
                      
                      <div className="col-date">
                        {formatDate(game.end_time)}
                      </div>
                      
                      <div className="col-actions">
                        <a 
                          href={game.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="external-link"
                          title="View on platform"
                        >
                          🔗
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Game Analysis Modal */}
      {showGameModal && selectedGame && (
        <div className="game-modal-overlay" onClick={() => setShowGameModal(false)}>
          <div className="game-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="game-title">
                <h3>{selectedGame.white} vs {selectedGame.black}</h3>
                <div className="game-meta">
                  <span>{getResultIcon(selectedGame).icon} {getResultIcon(selectedGame).text}</span>
                  <span>•</span>
                  <span>{getTimeClassIcon(selectedGame.time_class || 'unknown')} {Math.floor(parseInt(selectedGame.time_control || '0') / 60)}min</span>
                  <span>•</span>
                  <span>{selectedGame.eco}</span>
                </div>
              </div>
              <button onClick={() => setShowGameModal(false)} className="close-btn">×</button>
            </div>
            
            <div className="modal-content">
              <div className="board-section">
                <div className="chessboard-container">
                  <Chessboard 
                    options={{
                      position: boardPosition,
                      allowDragging: false,
                      boardOrientation: selectedGame.user_color || 'white',
                      showNotation: true,
                      animationDurationInMs: 200
                    }}
                  />
                </div>
                
                <div className="move-controls">
                  <button onClick={goToStart} className="control-btn">⏮️</button>
                  <button onClick={goToPreviousMove} className="control-btn">⏪</button>
                  <button onClick={goToNextMove} className="control-btn">⏩</button>
                  <button onClick={goToEnd} className="control-btn">⏭️</button>
                </div>
                
                <div className="move-info">
                  Move {currentMoveIndex + 1} of {gameHistory.length}
                  {currentMoveIndex >= 0 && gameHistory[currentMoveIndex] && (
                    <span className="current-move">{gameHistory[currentMoveIndex]}</span>
                  )}
                </div>
              </div>
              
              <div className="moves-section">
                <h4>Game Moves</h4>
                <div className="moves-list">
                  {gameHistory.map((move, index) => (
                    <button
                      key={index}
                      className={`move-btn ${index === currentMoveIndex ? 'active' : ''}`}
                      onClick={() => navigateToMove(index)}
                    >
                      <span className="move-number">{Math.floor(index / 2) + 1}{index % 2 === 0 ? '.' : '...'}</span>
                      <span className="move-notation">{move}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}