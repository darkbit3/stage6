const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const http = require('http');
const socketIo = require('socket.io');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const axios = require('axios');
const ioClient = require('socket.io-client');
require('dotenv').config();

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Hybrid DB Manager URL logic
const LOCAL_DB_MANAGER = 'http://localhost:3007';
const REMOTE_DB_MANAGER = 'https://db-manager-1.onrender.com';

function getDbManagerUrl() {
  return process.env.DB_MANAGER || LOCAL_DB_MANAGER;
}

let DB_MANAGER_URL = getDbManagerUrl();
// Test local, fallback to remote if not available
async function ensureDbManagerUrl() {
  try {
    await axios.get(LOCAL_DB_MANAGER + '/health', { timeout: 2000 });
    DB_MANAGER_URL = LOCAL_DB_MANAGER;
    return LOCAL_DB_MANAGER;
  } catch {
    DB_MANAGER_URL = REMOTE_DB_MANAGER;
    return REMOTE_DB_MANAGER;
  }
}

const BIGSERVER_URL = process.env.BIGSERVER_URL || `http://localhost:${process.env.BIGSERVER_PORT}`;

// Service connection status
let bigserverConnected = false;
let dbManagerConnected = false;

// WebSocket client for real-time connection to DB Manager
let dbManagerSocket = null;
let realtimeConnected = false;

// Check service connections
const checkServiceConnections = async () => {
  try {
    // Check BigServer connection
    try {
      const bigserverResponse = await axios.get(`${BIGSERVER_URL}/health`, { 
        timeout: 5000,
        headers: {
          'x-api-key': process.env.BIGSERVER_API_KEY
        }
      });
      if (bigserverResponse.status === 200) {
        bigserverConnected = true;
        logger.info('✅ Connected to Big Server (Port ' + process.env.BIGSERVER_PORT + ') with API key');
      }
    } catch (error) {
      logger.warn('❌ Failed to connect to Big Server (Port ' + process.env.BIGSERVER_PORT + '):', error.message);
      if (error.response && error.response.status === 401) {
        logger.warn('🔑 API Key authentication failed - check your API key configuration');
      }
    }

    // Hybrid: ensure DB Manager URL is correct before each check
    await ensureDbManagerUrl();
    try {
      const dbManagerResponse = await axios.get(`${DB_MANAGER_URL}/health`, { timeout: 5000 });
      if (dbManagerResponse.status === 200) {
        dbManagerConnected = true;
        logger.info('✅ Connected to DB Manager (Port 3007 or remote)');
      }
    } catch (error) {
      logger.warn('❌ Failed to connect to DB Manager (Port 3007 or remote):', error.message);
    }
  } catch (error) {
    logger.error('Error checking service connections:', error.message);
  }
};

// Initialize WebSocket connection to DB Manager
const initializeSocketConnection = async () => {
  try {
    await ensureDbManagerUrl();
    // Close existing connection if any
    if (dbManagerSocket) {
      dbManagerSocket.disconnect();
    }

    console.log('🔌 Stage6: Initializing WebSocket connection to DB Manager...');

    // Create socket connection to DB Manager
    dbManagerSocket = ioClient(DB_MANAGER_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    });

    // Connection event handlers
    dbManagerSocket.on('connect', () => {
      console.log('✅ Stage6: Connected to DB Manager via WebSocket');
      realtimeConnected = true;

      // Identify ourselves as Stage 6
      dbManagerSocket.emit('stage6-connect', {
        stage: 'stage6',
        timestamp: new Date().toISOString()
      });

      logger.info('✅ Stage6: WebSocket connection established with DB Manager');
    });

    dbManagerSocket.on('disconnect', (reason) => {
      console.log('❌ Stage6: Disconnected from DB Manager:', reason);
      realtimeConnected = false;
      logger.warn(`❌ Stage6: WebSocket disconnected from DB Manager: ${reason}`);
    });

    dbManagerSocket.on('connect_error', (error) => {
      console.log('❌ Stage6: WebSocket connection error:', error.message);
      realtimeConnected = false;
      logger.error('❌ Stage6: WebSocket connection error:', error.message);
    });

    dbManagerSocket.on('db-manager-connected', (data) => {
      console.log('📡 Stage6: DB Manager acknowledged connection:', data);
    });

    dbManagerSocket.on('game-data-update', (data) => {
      console.log('📊 Stage6: Received game data update:', data);
    });

    dbManagerSocket.on('bet-update', (data) => {
      console.log('💰 Stage6: Received bet update notification:', data);
    });

    dbManagerSocket.on('db-status-update', (data) => {
      console.log('🗄️ Stage6: Received DB status update:', data);
    });

  } catch (error) {
    console.error('❌ Stage6: Error initializing WebSocket connection:', error.message);
    realtimeConnected = false;
    logger.error('❌ Stage6: WebSocket initialization error:', error.message);
  }
};

// Function to notify DB Manager of bet placements
const notifyBetPlaced = (betData) => {
  if (dbManagerSocket && realtimeConnected) {
    try {
      dbManagerSocket.emit('bet-placed', {
        stage: 'stage6',
        ...betData,
        timestamp: new Date().toISOString()
      });
      console.log('📤 Stage6: Bet placement notification sent to DB Manager');
    } catch (error) {
      console.error('❌ Stage6: Error sending bet notification:', error.message);
    }
  } else {
    console.log('⚠️ Stage6: Cannot send bet notification - WebSocket not connected');
  }
};

// Function to request real-time game data
const requestRealtimeGameData = (stage = 'l') => {
  if (dbManagerSocket && realtimeConnected) {
    try {
      dbManagerSocket.emit('request-game-data', {
        stage: stage,
        requestingStage: 'stage6',
        timestamp: new Date().toISOString()
      });
      console.log(`📤 Stage6: Requested real-time game data for Stage ${stage.toUpperCase()}`);
    } catch (error) {
      console.error('❌ Stage6: Error requesting game data:', error.message);
    }
  } else {
    console.log('⚠️ Stage6: Cannot request game data - WebSocket not connected');
  }
};

// Note: MongoDB connection removed as it is not used in this version.

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 1000
});
app.use(limiter);

// API Routes
const apiPrefix = '/api/v1';
app.use(`${apiPrefix}/games`, require('./routes/gameRoutes'));
app.use(`${apiPrefix}/analytics`, require('./routes/analyticsRoutes'));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Stage 6 API',
      version: '1.0.0',
      description: 'Stage 6 Backend API Documentation'
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3006}`,
        description: 'Development server'
      }
    ]
  },
  apis: ['./src/routes/*.js']
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Socket.IO connection
io.on('connection', (socket) => {
  logger.info('User connected:', socket.id);
  
  socket.on('disconnect', () => {
    logger.info('User disconnected:', socket.id);
  });
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Stage 6 Backend API is running!',
    stage: 'Stage 6',
    port: process.env.PORT,
    connections: {
      bigserver: bigserverConnected,
      db_manager: dbManagerConnected,
      realtime: realtimeConnected
    }
  });
});

// Get latest game data with highest game ID and parsed selectedBoard
// Hybrid: always ensure DB Manager URL is correct before each call
app.get('/api/v1/game/latest-data', async (req, res) => {
  try {
    const { stage = 'l' } = req.query; // Default to stage L for Stage6
    console.log(`🔍 Stage6: Requesting latest game data from DB Manager for Stage ${stage.toUpperCase()}...`);

    await ensureDbManagerUrl();
    // Request highest game ID record from DB Manager for specific stage
    const response = await axios.get(`${DB_MANAGER_URL}/api/v1/stage-${stage}/last-game-id`, { 
      timeout: 10000 
    });

    if (response.data && response.data.success) {
      const gameData = response.data.data;
      console.log(`✅ Stage6: Received latest game data from DB Manager for Stage ${stage.toUpperCase()}:`, gameData);

      // Parse selectedBoard format: "+251909090909:2,+251909090910:4"
      const parsedData = parseSelectedBoard(gameData.selectedBoard || '');

      // Format response for frontend
      const formattedResponse = {
        gameId: gameData.gameId || '',
        payout: gameData.payout || 0,
        players: parsedData.playerIds,
        boards: parsedData.boards,
        totalPlayers: parsedData.totalPlayers,
        stage: stage.toUpperCase(),
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Stage6: Formatted latest game data for frontend:`, formattedResponse);

      res.json({
        success: true,
        data: formattedResponse,
        source: 'db_manager',
        stage: 'stage6',
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Invalid response from DB Manager');
    }

  } catch (error) {
    console.error('❌ Stage6: Error getting latest game data from DB Manager:', error.message);

    // Try to create a new game even if DB Manager fails
    try {
      const { stage = 'l' } = req.query;
      console.log(`🔄 Stage6: DB Manager failed, attempting to create new game for Stage ${stage.toUpperCase()}...`);

      const newGameData = await createNewGameForStage(stage.toLowerCase());
      console.log(`✅ Stage6: Created fallback game for Stage ${stage.toUpperCase()}:`, newGameData);

      res.json({
        success: true,
        data: newGameData,
        source: 'fallback_created',
        stage: 'stage6',
        warning: 'DB Manager unavailable, created new game',
        timestamp: new Date().toISOString()
      });
    } catch (createError) {
      console.error('❌ Stage6: Failed to create fallback game:', createError.message);

      // Last resort fallback
      const fallbackData = {
        gameId: 'G' + Date.now().toString().slice(-5),
        payout: 0,
        players: '',
        boards: '',
        totalPlayers: 0,
        stage: stage.toUpperCase(),
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: fallbackData,
        source: 'emergency_fallback',
        stage: 'stage6',
        warning: 'All systems failed, using emergency fallback',
        timestamp: new Date().toISOString()
      });
    }
  }
});

// Helper function to parse selectedBoard format
function parseSelectedBoard(selectedBoard) {
  try {
    if (!selectedBoard || typeof selectedBoard !== 'string') {
      return {
        playerIds: '',
        boards: '',
        totalPlayers: 0
      };
    }
    
    // Split by comma to get individual player:board pairs
    const pairs = selectedBoard.split(',');
    
    const playerIds = [];
    const boards = [];
    
    pairs.forEach(pair => {
      const [playerId, board] = pair.split(':');
      if (playerId && board) {
        playerIds.push(playerId.trim());
        boards.push(board.trim());
      }
    });
    
    return {
      playerIds: playerIds.join(','),
      boards: boards.join(','),
      totalPlayers: playerIds.length
    };
    
  } catch (error) {
    console.error('Error parsing selectedBoard:', error);
    return {
      playerIds: '',
      boards: '',
      totalPlayers: 0
    };
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    stage: 'Stage 6',
    port: process.env.PORT,
    connections: {
      bigserver: bigserverConnected,
      db_manager: dbManagerConnected,
      realtime: realtimeConnected
    },
    timestamp: new Date().toISOString()
  });
});

// Service status endpoint
app.get('/services', (req, res) => {
  res.json({
    stage: 'Stage 6',
    services: {
      bigserver: {
        url: BIGSERVER_URL,
        connected: bigserverConnected,
        port: process.env.BIGSERVER_PORT
      },
      db_manager: {
        url: DB_MANAGER_URL,
        connected: dbManagerConnected,
        port: process.env.DB_MANAGER_PORT
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT;

// Start server and check connections
server.listen(PORT, async () => {
  logger.info(`🚀 Stage 6 Backend API is running on port ${PORT}`);
  logger.info(`📋 Health Check: http://localhost:${PORT}/health`);
  logger.info(`🔗 Services Status: http://localhost:${PORT}/services`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  logger.info('---');

  // Check service connections on startup
  await checkServiceConnections();

  // Initialize WebSocket connection to DB Manager
  await initializeSocketConnection();

  // Check connections every 30 seconds
  setInterval(checkServiceConnections, 30000);
});

module.exports = { app, server, io };

// Helper functions for creating new games when DB Manager is unavailable
async function createNewGameForStage(stage) {
  try {
    // Generate a new game ID based on timestamp
    const timestamp = Date.now();
    const gameId = `G${timestamp.toString().slice(-5)}`;
    
    console.log(`🎯 Stage6: No existing game data found for Stage ${stage.toUpperCase()}`);
    
    // Return empty game state - no sample data
    return {
      gameId: gameId,
      payout: 0,
      players: [],
      boards: [],
      totalPlayers: 0,
      stage: stage.toUpperCase(),
      timestamp: new Date().toISOString(),
      message: 'No active game found. Please place bets to start a new game.'
    };
    
  } catch (error) {
    console.error('❌ Stage6: Error creating empty game response:', error.message);
    throw error;
  }
}

