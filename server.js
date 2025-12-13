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

// Parse JSON bodies for API routes
app.use(express.json());

// ============================================================
// REST API for Agents
// ============================================================

// GET /api/sessions/:sessionId - Get session info and all elements
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    id: session.id,
    elementCount: session.elements.length,
    elements: session.elements,
    userCount: session.clients.size,
    createdAt: session.createdAt
  });
});

// GET /api/sessions/:sessionId/elements - Get all elements
app.get('/api/sessions/:sessionId/elements', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(session.elements);
});

// GET /api/sessions/:sessionId/elements/:elementId - Get a specific element
app.get('/api/sessions/:sessionId/elements/:elementId', (req, res) => {
  const { sessionId, elementId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const element = session.elements.find(el => el.id === elementId);
  if (!element) {
    return res.status(404).json({ error: 'Element not found' });
  }
  
  res.json(element);
});

// POST /api/sessions/:sessionId/elements - Create a new element
app.post('/api/sessions/:sessionId/elements', (req, res) => {
  const { sessionId } = req.params;
  const session = getOrCreateSession(sessionId);
  
  const elementData = req.body;
  
  // Validate required fields
  if (!elementData.type) {
    return res.status(400).json({ error: 'Element type is required' });
  }
  
  const validTypes = ['rectangle', 'circle', 'line', 'pen', 'text', 'note'];
  if (!validTypes.includes(elementData.type)) {
    return res.status(400).json({ 
      error: `Invalid element type. Must be one of: ${validTypes.join(', ')}` 
    });
  }
  
  // Create element with ID and metadata
  const element = {
    ...elementData,
    id: elementData.id || uuidv4(),
    createdBy: 'api',
    timestamp: Date.now()
  };
  
  session.elements.push(element);
  
  // Broadcast to connected WebSocket clients
  broadcastAll(session, {
    type: 'draw',
    element: element
  });
  
  res.status(201).json(element);
});

// POST /api/sessions/:sessionId/elements/batch - Create multiple elements
app.post('/api/sessions/:sessionId/elements/batch', (req, res) => {
  const { sessionId } = req.params;
  const session = getOrCreateSession(sessionId);
  
  const elementsData = req.body;
  
  if (!Array.isArray(elementsData)) {
    return res.status(400).json({ error: 'Request body must be an array of elements' });
  }
  
  const validTypes = ['rectangle', 'circle', 'line', 'pen', 'text', 'note'];
  const createdElements = [];
  
  for (const elementData of elementsData) {
    if (!elementData.type) {
      return res.status(400).json({ error: 'Each element must have a type' });
    }
    if (!validTypes.includes(elementData.type)) {
      return res.status(400).json({ 
        error: `Invalid element type: ${elementData.type}. Must be one of: ${validTypes.join(', ')}` 
      });
    }
    
    const element = {
      ...elementData,
      id: elementData.id || uuidv4(),
      createdBy: 'api',
      timestamp: Date.now()
    };
    
    session.elements.push(element);
    createdElements.push(element);
    
    // Broadcast each element to connected clients
    broadcastAll(session, {
      type: 'draw',
      element: element
    });
  }
  
  res.status(201).json(createdElements);
});

// PUT /api/sessions/:sessionId/elements/:elementId - Update an element
app.put('/api/sessions/:sessionId/elements/:elementId', (req, res) => {
  const { sessionId, elementId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const elementIndex = session.elements.findIndex(el => el.id === elementId);
  if (elementIndex === -1) {
    return res.status(404).json({ error: 'Element not found' });
  }
  
  const updatedElement = {
    ...session.elements[elementIndex],
    ...req.body,
    id: elementId, // Prevent ID from being changed
    updatedBy: 'api',
    updatedAt: Date.now()
  };
  
  session.elements[elementIndex] = updatedElement;
  
  // Broadcast to connected WebSocket clients
  broadcastAll(session, {
    type: 'move',
    elementId: elementId,
    element: updatedElement
  });
  
  res.json(updatedElement);
});

// DELETE /api/sessions/:sessionId/elements/:elementId - Delete an element
app.delete('/api/sessions/:sessionId/elements/:elementId', (req, res) => {
  const { sessionId, elementId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const elementIndex = session.elements.findIndex(el => el.id === elementId);
  if (elementIndex === -1) {
    return res.status(404).json({ error: 'Element not found' });
  }
  
  session.elements.splice(elementIndex, 1);
  
  // Broadcast to connected WebSocket clients
  broadcastAll(session, {
    type: 'erase',
    elementId: elementId
  });
  
  res.status(204).send();
});

// DELETE /api/sessions/:sessionId/elements - Clear all elements
app.delete('/api/sessions/:sessionId/elements', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  session.elements = [];
  
  // Broadcast to connected WebSocket clients
  broadcastAll(session, {
    type: 'clear'
  });
  
  res.status(204).send();
});

// GET /api/schema - Get element schema documentation
app.get('/api/schema', (req, res) => {
  res.json({
    description: 'Whiteboard element schemas',
    types: {
      rectangle: {
        description: 'Rectangle shape',
        required: ['type', 'x', 'y', 'width', 'height'],
        properties: {
          type: { type: 'string', value: 'rectangle' },
          x: { type: 'number', description: 'X position of top-left corner' },
          y: { type: 'number', description: 'Y position of top-left corner' },
          width: { type: 'number', description: 'Width of rectangle' },
          height: { type: 'number', description: 'Height of rectangle' },
          color: { type: 'string', default: '#000000', description: 'Stroke color (hex)' },
          strokeWidth: { type: 'number', default: 2, description: 'Stroke width in pixels' }
        },
        example: { type: 'rectangle', x: 100, y: 100, width: 200, height: 150, color: '#3498db', strokeWidth: 2 }
      },
      circle: {
        description: 'Circle shape',
        required: ['type', 'cx', 'cy', 'radius'],
        properties: {
          type: { type: 'string', value: 'circle' },
          cx: { type: 'number', description: 'X position of center' },
          cy: { type: 'number', description: 'Y position of center' },
          radius: { type: 'number', description: 'Radius of circle' },
          color: { type: 'string', default: '#000000', description: 'Stroke color (hex)' },
          strokeWidth: { type: 'number', default: 2, description: 'Stroke width in pixels' }
        },
        example: { type: 'circle', cx: 200, cy: 200, radius: 50, color: '#e74c3c', strokeWidth: 2 }
      },
      line: {
        description: 'Straight line',
        required: ['type', 'x1', 'y1', 'x2', 'y2'],
        properties: {
          type: { type: 'string', value: 'line' },
          x1: { type: 'number', description: 'Starting X position' },
          y1: { type: 'number', description: 'Starting Y position' },
          x2: { type: 'number', description: 'Ending X position' },
          y2: { type: 'number', description: 'Ending Y position' },
          color: { type: 'string', default: '#000000', description: 'Line color (hex)' },
          strokeWidth: { type: 'number', default: 2, description: 'Stroke width in pixels' }
        },
        example: { type: 'line', x1: 50, y1: 50, x2: 200, y2: 150, color: '#2ecc71', strokeWidth: 2 }
      },
      pen: {
        description: 'Freehand drawing (series of points)',
        required: ['type', 'points'],
        properties: {
          type: { type: 'string', value: 'pen' },
          points: { type: 'array', items: { type: 'object', properties: { x: 'number', y: 'number' } }, description: 'Array of {x, y} points' },
          color: { type: 'string', default: '#000000', description: 'Stroke color (hex)' },
          strokeWidth: { type: 'number', default: 2, description: 'Stroke width in pixels' }
        },
        example: { type: 'pen', points: [{ x: 10, y: 10 }, { x: 15, y: 20 }, { x: 25, y: 15 }], color: '#9b59b6', strokeWidth: 2 }
      },
      text: {
        description: 'Text element',
        required: ['type', 'x', 'y', 'text'],
        properties: {
          type: { type: 'string', value: 'text' },
          x: { type: 'number', description: 'X position' },
          y: { type: 'number', description: 'Y position' },
          text: { type: 'string', description: 'Text content' },
          fontSize: { type: 'number', default: 16, description: 'Font size in pixels' },
          color: { type: 'string', default: '#000000', description: 'Text color (hex)' }
        },
        example: { type: 'text', x: 100, y: 100, text: 'Hello World', fontSize: 24, color: '#34495e' }
      },
      note: {
        description: 'Sticky note with text',
        required: ['type', 'x', 'y', 'text', 'width', 'height'],
        properties: {
          type: { type: 'string', value: 'note' },
          x: { type: 'number', description: 'X position of top-left corner' },
          y: { type: 'number', description: 'Y position of top-left corner' },
          width: { type: 'number', default: 150, description: 'Width of note' },
          height: { type: 'number', default: 100, description: 'Height of note' },
          text: { type: 'string', description: 'Note content' },
          backgroundColor: { type: 'string', default: '#fff9c4', description: 'Background color (hex)' }
        },
        example: { type: 'note', x: 300, y: 100, width: 150, height: 100, text: 'Remember this!', backgroundColor: '#fff9c4' }
      }
    },
    endpoints: {
      'GET /api/sessions/:sessionId': 'Get session info and all elements',
      'GET /api/sessions/:sessionId/elements': 'Get all elements',
      'GET /api/sessions/:sessionId/elements/:elementId': 'Get a specific element',
      'POST /api/sessions/:sessionId/elements': 'Create a new element',
      'POST /api/sessions/:sessionId/elements/batch': 'Create multiple elements',
      'PUT /api/sessions/:sessionId/elements/:elementId': 'Update an element',
      'DELETE /api/sessions/:sessionId/elements/:elementId': 'Delete an element',
      'DELETE /api/sessions/:sessionId/elements': 'Clear all elements'
    }
  });
});

// Session route - serve the whiteboard app (must come after API routes)
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
