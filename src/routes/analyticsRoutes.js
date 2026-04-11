const express = require('express');
const router = express.Router();

// Mock analytics data
let analyticsData = {
  overview: {
    totalGames: 150,
    totalPlayers: 1250,
    totalRevenue: 15000,
    totalPayouts: 12000,
    profit: 3000,
    averageGameDuration: 1800,
    averagePlayersPerGame: 8.3
  },
  performance: {
    gamesByStatus: {
      completed: 120,
      active: 15,
      cancelled: 10,
      scheduled: 5
    },
    revenueByMonth: [
      { month: '2024-01', revenue: 2000, games: 20 },
      { month: '2024-02', revenue: 2500, games: 25 },
      { month: '2024-03', revenue: 3000, games: 30 },
      { month: '2024-04', revenue: 2800, games: 28 },
      { month: '2024-05', revenue: 3200, games: 32 },
      { month: '2024-06', revenue: 1500, games: 15 }
    ],
    playerRetention: {
      new: 450,
      returning: 800,
      churnRate: 12.5
    }
  },
  patterns: {
    mostWon: [
      { pattern: 'line', wins: 450, percentage: 45.0 },
      { pattern: 'four_corners', wins: 250, percentage: 25.0 },
      { pattern: 'full_house', wins: 150, percentage: 15.0 },
      { pattern: 'diagonal', wins: 100, percentage: 10.0 },
      { pattern: 'postage_stamp', wins: 50, percentage: 5.0 }
    ],
    averageCallsToWin: {
      line: 18.5,
      four_corners: 12.3,
      full_house: 45.2,
      diagonal: 22.1,
      postage_stamp: 28.7
    }
  },
  players: {
    topEarners: [
      { playerId: 'player1', playerName: 'John Doe', totalWinnings: 1250, wins: 15 },
      { playerId: 'player2', playerName: 'Jane Smith', totalWinnings: 980, wins: 12 },
      { playerId: 'player3', playerName: 'Bob Johnson', totalWinnings: 750, wins: 9 }
    ],
    demographics: {
      byAge: {
        '18-25': 15,
        '26-35': 35,
        '36-45': 30,
        '46-55': 15,
        '56+': 5
      },
      byLocation: {
        'North America': 45,
        'Europe': 30,
        'Asia': 20,
        'Other': 5
      }
    }
  }
};

// GET /api/analytics/overview - Get analytics overview
router.get('/overview', (req, res) => {
  const { period = 'all' } = req.query;
  
  // In real implementation, would filter by period
  let overview = analyticsData.overview;
  
  if (period !== 'all') {
    // Mock period filtering
    overview = {
      ...overview,
      totalGames: Math.floor(overview.totalGames * 0.3),
      totalRevenue: Math.floor(overview.totalRevenue * 0.3),
      totalPayouts: Math.floor(overview.totalPayouts * 0.3)
    };
  }
  
  res.json({
    success: true,
    data: overview,
    period,
    stage: 'Stage 6 - Results & Analytics'
  });
});

// GET /api/analytics/performance - Get performance metrics
router.get('/performance', (req, res) => {
  const { startDate, endDate, metric } = req.query;
  
  let performance = analyticsData.performance;
  
  // In real implementation, would filter by date range and metric
  if (startDate && endDate) {
    // Mock date filtering
    performance = {
      ...performance,
      revenueByMonth: performance.revenueByMonth.slice(-3)
    };
  }
  
  if (metric) {
    performance = { [metric]: performance[metric] };
  }
  
  res.json({
    success: true,
    data: performance
  });
});

// GET /api/analytics/patterns - Get pattern analytics
router.get('/patterns', (req, res) => {
  const { sortBy = 'wins', order = 'desc' } = req.query;
  
  let patterns = analyticsData.patterns.mostWon;
  
  // Sort patterns
  patterns.sort((a, b) => {
    const aValue = a[sortBy] || 0;
    const bValue = b[sortBy] || 0;
    return order === 'desc' ? bValue - aValue : aValue - bValue;
  });
  
  res.json({
    success: true,
    data: {
      mostWon: patterns,
      averageCallsToWin: analyticsData.patterns.averageCallsToWin
    }
  });
});

// GET /api/analytics/players - Get player analytics
router.get('/players', (req, res) => {
  const { type = 'overview' } = req.query;
  
  switch (type) {
    case 'topEarners':
      res.json({
        success: true,
        data: analyticsData.players.topEarners
      });
      break;
      
    case 'demographics':
      res.json({
        success: true,
        data: analyticsData.players.demographics
      });
      break;
      
    default:
      res.json({
        success: true,
        data: analyticsData.players
      });
  }
});

// GET /api/analytics/revenue - Get revenue analytics
router.get('/revenue', (req, res) => {
  const { period = 'monthly', startDate, endDate } = req.query;
  
  let revenueData = analyticsData.performance.revenueByMonth;
  
  if (period === 'daily') {
    // Mock daily revenue data
    revenueData = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      revenue: Math.floor(Math.random() * 500) + 100,
      games: Math.floor(Math.random() * 5) + 1
    }));
  } else if (period === 'weekly') {
    // Mock weekly revenue data
    revenueData = Array.from({ length: 12 }, (_, i) => ({
      week: `Week ${i + 1}`,
      revenue: Math.floor(Math.random() * 2000) + 500,
      games: Math.floor(Math.random() * 20) + 5
    }));
  }
  
  // Calculate totals
  const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
  const totalGames = revenueData.reduce((sum, item) => sum + item.games, 0);
  const averageRevenuePerGame = totalGames > 0 ? totalRevenue / totalGames : 0;
  
  res.json({
    success: true,
    data: {
      period,
      revenue: revenueData,
      summary: {
        totalRevenue,
        totalGames,
        averageRevenuePerGame: Math.round(averageRevenuePerGame * 100) / 100
      }
    }
  });
});

// GET /api/analytics/trends - Get trend analysis
router.get('/trends', (req, res) => {
  const { metric = 'revenue', period = '30d' } = req.query;
  
  // Mock trend data
  const generateTrendData = (metric, days) => {
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      value: Math.floor(Math.random() * 1000) + 500,
      change: Math.floor(Math.random() * 200) - 100
    }));
  };
  
  const days = parseInt(period.replace('d', '')) || 30;
  const trendData = generateTrendData(metric, days);
  
  // Calculate trend
  const firstValue = trendData[0].value;
  const lastValue = trendData[trendData.length - 1].value;
  const trendChange = ((lastValue - firstValue) / firstValue * 100).toFixed(2);
  const trendDirection = trendChange > 0 ? 'up' : trendChange < 0 ? 'down' : 'stable';
  
  res.json({
    success: true,
    data: {
      metric,
      period,
      trend: {
        direction: trendDirection,
        change: parseFloat(trendChange),
        firstValue,
        lastValue
      },
      data: trendData
    }
  });
});

// POST /api/analytics/report - Generate custom report
router.post('/report', (req, res) => {
  const { 
    reportType, 
    filters = {}, 
    format = 'json',
    includeCharts = false 
  } = req.body;
  
  if (!reportType) {
    return res.status(400).json({
      success: false,
      error: 'Report type is required'
    });
  }
  
  // Generate report based on type
  let reportData;
  
  switch (reportType) {
    case 'financial':
      reportData = {
        title: 'Financial Report',
        period: filters.period || 'last_30_days',
        summary: analyticsData.overview,
        revenue: analyticsData.performance.revenueByMonth,
        profit: analyticsData.overview.profit
      };
      break;
      
    case 'player':
      reportData = {
        title: 'Player Analytics Report',
        period: filters.period || 'last_30_days',
        overview: analyticsData.players,
        retention: analyticsData.performance.playerRetention
      };
      break;
      
    case 'game':
      reportData = {
        title: 'Game Performance Report',
        period: filters.period || 'last_30_days',
        overview: analyticsData.overview,
        patterns: analyticsData.patterns,
        status: analyticsData.performance.gamesByStatus
      };
      break;
      
    default:
      return res.status(400).json({
        success: false,
        error: 'Invalid report type'
      });
  }
  
  // Add metadata
  reportData.generatedAt = new Date().toISOString();
  reportData.format = format;
  reportData.includeCharts = includeCharts;
  
  res.status(201).json({
    success: true,
    data: reportData,
    message: 'Report generated successfully'
  });
});

module.exports = router;
