# AGENTS.md

## Build Commands
- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload

## Code Style Guidelines

### Node.js Backend (server.js)
- Use CommonJS require() syntax (already established)
- Express.js routing with RESTful patterns
- Error handling with proper HTTP status codes
- WebSocket messages in JSON format with type field
- Use async/await for database operations

### Frontend JavaScript (public/app.js)
- Class-based architecture (Whiteboard class)
- Event-driven programming with addEventListener
- Canvas API for rendering with proper coordinate transformations
- WebSocket communication for real-time sync
- Touch event support for mobile devices

### General Conventions
- Use camelCase for variables and functions
- Use PascalCase for classes
- Constants in UPPER_SNAKE_CASE
- Hex colors for styling (#000000 format)
- Element IDs using uuid library
- Console.log for debugging (remove in production)

### File Structure
- server.js - Main Express server and WebSocket handler
- public/app.js - Frontend whiteboard application
- public/index.html - Main HTML template
- public/styles.css - All styling rules

### API Patterns
- REST endpoints for external agent access (/api/sessions/:sessionId/elements)
- WebSocket for real-time browser collaboration
- JSON responses with consistent error format
- Session-based organization with URL routing

### Testing
No test framework currently configured. Add tests before implementing new features.