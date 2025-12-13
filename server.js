const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Store sessions in memory
const sessions = new Map();

// Root route - create new session and redirect (must come before static)
app.get('/', (req, res) => {
  const sessionId = generateSessionId();
  res.redirect(`/${sessionId}`);
});

// Serve static files (but not index.html at root)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Session route - serve the whiteboard app
app.get('/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Generate a short, readable session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 8);
}

// Get or create a session
function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      elements: [],
      clients: new Set(),
      createdAt: Date.now()
    });
  }
  return sessions.get(sessionId);
}

// Broadcast message to all clients in a session except sender
function broadcast(session, message, excludeClient = null) {
  const data = JSON.stringify(message);
  session.clients.forEach(client => {
    if (client !== excludeClient && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Broadcast to all clients in a session including sender
function broadcastAll(session, message) {
  const data = JSON.stringify(message);
  session.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  // Extract session ID from URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('session');
  
  if (!sessionId) {
    ws.close(1008, 'Session ID required');
    return;
  }

  const session = getOrCreateSession(sessionId);
  session.clients.add(ws);
  
  // Generate a user ID for this connection
  const userId = uuidv4().substring(0, 8);
  ws.userId = userId;
  ws.sessionId = sessionId;

  console.log(`User ${userId} joined session ${sessionId}. Total users: ${session.clients.size}`);

  // Send current state to new client
  ws.send(JSON.stringify({
    type: 'init',
    userId: userId,
    elements: session.elements,
    userCount: session.clients.size
  }));

  // Notify all clients of new user count
  broadcastAll(session, {
    type: 'userCount',
    count: session.clients.size
  });

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, session, message);
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    session.clients.delete(ws);
    console.log(`User ${userId} left session ${sessionId}. Total users: ${session.clients.size}`);

    // Notify remaining clients of user count
    broadcastAll(session, {
      type: 'userCount',
      count: session.clients.size
    });
    
    // Notify remaining clients that this user left (for cursor cleanup)
    broadcast(session, {
      type: 'userLeft',
      oderId: userId
    });

    // Clean up empty sessions after a delay
    if (session.clients.size === 0) {
      setTimeout(() => {
        if (session.clients.size === 0) {
          sessions.delete(sessionId);
          console.log(`Session ${sessionId} cleaned up`);
        }
      }, 60000); // 1 minute delay
    }
  });
});

// Handle different message types
function handleMessage(ws, session, message) {
  switch (message.type) {
    case 'draw':
      // Add element to session state
      const element = {
        ...message.element,
        id: message.element.id || uuidv4(),
        createdBy: ws.userId,
        timestamp: Date.now()
      };
      session.elements.push(element);
      
      // Broadcast to other clients
      broadcast(session, {
        type: 'draw',
        element: element
      }, ws);
      break;

    case 'erase':
      // Remove element from session state
      session.elements = session.elements.filter(el => el.id !== message.elementId);
      
      // Broadcast to other clients
      broadcast(session, {
        type: 'erase',
        elementId: message.elementId
      }, ws);
      break;

    case 'clear':
      // Clear all elements
      session.elements = [];
      
      // Broadcast to other clients
      broadcast(session, {
        type: 'clear'
      }, ws);
      break;

    case 'cursor':
      // Broadcast cursor position to other clients
      broadcast(session, {
        type: 'cursor',
        oderId: ws.userId,
        x: message.x,
        y: message.y
      }, ws);
      break;

    case 'move':
      // Update element position in session state
      const elementIndex = session.elements.findIndex(el => el.id === message.elementId);
      if (elementIndex !== -1) {
        session.elements[elementIndex] = {
          ...message.element,
          movedBy: ws.userId,
          movedAt: Date.now()
        };
        
        // Broadcast to other clients
        broadcast(session, {
          type: 'move',
          elementId: message.elementId,
          element: session.elements[elementIndex]
        }, ws);
      }
      break;

    case 'reorder':
      // Reorder element (move to front/back)
      const reorderIndex = session.elements.findIndex(el => el.id === message.elementId);
      if (reorderIndex !== -1) {
        const [element] = session.elements.splice(reorderIndex, 1);
        if (message.position === 'front') {
          session.elements.push(element);
        } else if (message.position === 'back') {
          session.elements.unshift(element);
        }
        
        // Broadcast to other clients
        broadcast(session, {
          type: 'reorder',
          elementId: message.elementId,
          position: message.position
        }, ws);
      }
      break;

    default:
      console.warn('Unknown message type:', message.type);
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`Whiteboard server running at http://localhost:${PORT}`);
});
