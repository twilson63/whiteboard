# Collaborative Whiteboard

A real-time collaborative whiteboard web application that allows multiple users to draw, add shapes, and create notes together on a shared canvas.

## Features

- **Real-time Collaboration** - Multiple users can draw simultaneously with instant sync
- **Drawing Tools** - Pen, rectangle, circle, line, text, and sticky notes
- **Session Management** - Each whiteboard has a unique URL for easy sharing
- **No Registration Required** - Start collaborating immediately
- **Mobile Support** - Touch-enabled for tablet drawing
- **Export Options** - Save your whiteboard as PNG or SVG

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

Open http://localhost:3000 to create a new whiteboard session.

## API

The whiteboard provides a REST API for programmatic access:

### Core Endpoints
- `GET /api/sessions/:sessionId/elements` - Get all elements
- `POST /api/sessions/:sessionId/elements` - Create element
- `POST /api/sessions/:sessionId/elements/batch` - Create multiple elements
- `PUT /api/sessions/:sessionId/elements/:elementId` - Update element
- `DELETE /api/sessions/:sessionId/elements/:elementId` - Delete element

### Documentation
- `GET /api/schema` - Element type schemas
- `GET /api/agent` - Comprehensive API guide

## Element Types

```javascript
// Rectangle
{type: "rectangle", x: 100, y: 100, width: 200, height: 150, color: "#3498db"}

// Circle  
{type: "circle", cx: 200, cy: 200, radius: 50, color: "#e74c3c"}

// Line
{type: "line", x1: 50, y1: 50, x2: 200, y2: 150, color: "#2ecc71"}

// Freehand drawing
{type: "pen", points: [{x: 10, y: 10}, {x: 20, y: 30}], color: "#9b59b6"}

// Text
{type: "text", x: 100, y: 100, text: "Hello", fontSize: 24}

// Sticky note
{type: "note", x: 300, y: 100, width: 150, height: 100, text: "Remember this!"}
```

## Usage

1. **Create Session** - Navigate to the root URL to generate a new session
2. **Share URL** - Copy the session URL and share with collaborators
3. **Draw Together** - All changes appear instantly for connected users
4. **Export** - Save your work as PNG or SVG images

## Technology Stack

- **Frontend**: HTML5 Canvas, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Real-time**: WebSocket
- **Storage**: LMDB (lightning memory-mapped database)

## Development

See [AGENTS.md](./AGENTS.md) for development guidelines and build commands.

## License

MIT