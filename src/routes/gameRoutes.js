const express = require('express');
const router = express.Router();

// Mock game data for Stage 6 (Results & Analytics)
let games = [
  {
    id: 1,
    name: 'Bingo Game 1',
    stage: 'Stage 6',
    status: 'completed',
    startTime: new Date(Date.now() - 3600000).toISOString(),
    endTime: new Date(Date.now() - 1800000).toISOString(),
    duration: 1800, // seconds
    totalPlayers: 25,
    totalCards: 48,
    calledNumbers: [1, 15, 30, 45, 60, 7, 22, 37, 52, 67, 12, 28, 43, 58, 73],
    winners: [
      {
        id: 'win1',
        playerId: 'player1',
        playerName: 'John Doe',
        cardId: 'card1',
        pattern: 'line',
        wonAt: new Date(Date.now() - 2400000).toISOString(),
        winningNumbers: [1, 15, 30, 45, 60],
        prize: 100
      },
      {
        id: 'win2',
        playerId: 'player2',
        playerName: 'Jane Smith',
        cardId: 'card2',
        pattern: 'four_corners',
        wonAt: new Date(Date.now() - 2000000).toISOString(),
        winningNumbers: [7, 22, 37, 52],
        prize: 50
      }
    ],
    settings: {
      winPatterns: ['line', 'full_house', 'four_corners'],
      maxWinners: 3,
      cardPrice: 5,
      totalPrizePool: 250
    },
    analytics: {
      averageCallsPerWin: 12.5,
      fastestWin: 900, // seconds
      slowestWin: 1800, // seconds
      totalRevenue: 240,
      totalPayouts: 150,
      profit: 90
    }
  }
];

// GET /api/games - Get all games
router.get('/', (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  
  let filteredGames = games;
  
  if (status) {
    filteredGames = games.filter(g => g.status === status);
  }
  
  const paginatedGames = filteredGames.slice(
    parseInt(offset), 
    parseInt(offset) + parseInt(limit)
  );
  
  res.json({
    success: true,
    data: paginatedGames,
    pagination: {
      total: filteredGames.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: parseInt(offset) + parseInt(limit) < filteredGames.length
    },
    stage: 'Stage 6 - Results & Analytics'
  });
});

// GET /api/games/:id - Get specific game
router.get('/:id', (req, res) => {
  const game = games.find(g => g.id === parseInt(req.params.id));
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found'
    });
  }
  res.json({
    success: true,
    data: game
  });
});

// GET /api/games/:id/results - Get detailed game results
router.get('/:id/results', (req, res) => {
  const game = games.find(g => g.id === parseInt(req.params.id));
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found'
    });
  }
  
  const results = {
    gameId: game.id,
    gameName: game.name,
    status: game.status,
    startTime: game.startTime,
    endTime: game.endTime,
    duration: game.duration,
    summary: {
      totalPlayers: game.totalPlayers,
      totalCards: game.totalCards,
      totalWinners: game.winners.length,
      totalCalledNumbers: game.calledNumbers.length,
      totalRevenue: game.analytics.totalRevenue,
      totalPayouts: game.analytics.totalPayouts,
      profit: game.analytics.profit
    },
    winners: game.winners,
    calledNumbers: game.calledNumbers,
    settings: game.settings,
    analytics: game.analytics
  };
  
  res.json({
    success: true,
    data: results
  });
});

// GET /api/games/:id/winners - Get game winners
router.get('/:id/winners', (req, res) => {
  const game = games.find(g => g.id === parseInt(req.params.id));
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found'
    });
  }
  
  res.json({
    success: true,
    data: {
      winners: game.winners,
      totalWinners: game.winners.length,
      totalPayouts: game.winners.reduce((sum, w) => sum + w.prize, 0)
    }
  });
});

// POST /api/games/:id/export - Export game results
router.post('/:id/export', (req, res) => {
  const game = games.find(g => g.id === parseInt(req.params.id));
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found'
    });
  }
  
  const { format = 'json' } = req.body;
  
  let exportData;
  let contentType;
  let filename;
  
  switch (format.toLowerCase()) {
    case 'csv':
      exportData = generateCSVExport(game);
      contentType = 'text/csv';
      filename = `game_${game.id}_results.csv`;
      break;
      
    case 'pdf':
      // In real implementation, would use PDF generation library
      exportData = generatePDFExport(game);
      contentType = 'application/pdf';
      filename = `game_${game.id}_results.pdf`;
      break;
      
    default:
      exportData = JSON.stringify(game, null, 2);
      contentType = 'application/json';
      filename = `game_${game.id}_results.json`;
  }
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(exportData);
});

// GET /api/games/recent - Get recent games
router.get('/recent', (req, res) => {
  const { limit = 10 } = req.query;
  
  const recentGames = games
    .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))
    .slice(0, parseInt(limit));
  
  res.json({
    success: true,
    data: recentGames,
    count: recentGames.length
  });
});

// GET /api/games/leaderboard - Get game leaderboard
router.get('/leaderboard', (req, res) => {
  const { period = 'all', limit = 10 } = req.query;
  
  // Aggregate winners across all games
  const leaderboard = {};
  
  games.forEach(game => {
    game.winners.forEach(winner => {
      if (!leaderboard[winner.playerId]) {
        leaderboard[winner.playerId] = {
          playerId: winner.playerId,
          playerName: winner.playerName,
          wins: 0,
          totalPrizes: 0,
          patterns: {},
          lastWin: null
        };
      }
      
      const player = leaderboard[winner.playerId];
      player.wins += 1;
      player.totalPrizes += winner.prize;
      player.patterns[winner.pattern] = (player.patterns[winner.pattern] || 0) + 1;
      
      if (!player.lastWin || new Date(winner.wonAt) > new Date(player.lastWin)) {
        player.lastWin = winner.wonAt;
      }
    });
  });
  
  const sortedLeaderboard = Object.values(leaderboard)
    .sort((a, b) => b.totalPrizes - a.totalPrizes)
    .slice(0, parseInt(limit));
  
  res.json({
    success: true,
    data: sortedLeaderboard,
    count: sortedLeaderboard.length
  });
});

// Helper functions for export
function generateCSVExport(game) {
  const headers = ['Game ID', 'Player Name', 'Pattern', 'Win Time', 'Prize'];
  const rows = game.winners.map(winner => [
    game.id,
    winner.playerName,
    winner.pattern,
    winner.wonAt,
    winner.prize
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function generatePDFExport(game) {
  // Mock PDF generation - in real implementation would use PDF library
  return `PDF Export for Game ${game.id}\n\n${JSON.stringify(game, null, 2)}`;
}

module.exports = router;
