# AGENTS.md

## Build Commands

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-reload (uses `node --watch`)

## Testing

No test framework is currently configured. Before implementing new features, add an appropriate test framework and write tests to ensure code quality.

## Code Style Guidelines

### Node.js Backend (server.js)

**Module System:**
- Use CommonJS `require()` syntax (already established in codebase)
- Avoid ES6 import/export statements

**Express.js Patterns:**
- Use RESTful routing patterns with Express
- Routes are organized: root routes first, static files, then API routes
- Session routes come last to avoid conflicts

**Error Handling:**
- Return proper HTTP status codes:
  - 400 for invalid input
  - 404 for missing resources (sessions/elements)
  - 500 for server errors
- Use consistent JSON error format: `{ error: "message" }`
- Always validate input before processing

**WebSocket Messages:**
- All WebSocket messages must be JSON with a `type` field
- Use `JSON.parse()`/`JSON.stringify()` for message handling
- Broadcast messages to other clients, optionally exclude sender

**Database Operations:**
- Use LMDB for persistent storage
- Use in-memory Map for session state with WebSocket clients
- Save changes to LMDB immediately after modifying elements
- Clean up in-memory sessions after 1 minute of inactivity

**Naming:**
- Functions: camelCase (`handleMessage`, `saveSession`)
- Constants: UPPER_SNAKE_CASE (`PORT`, `DATA_DIR`)
- Classes: PascalCase (none currently, use if adding)

**Validation:**
- Validate all API input (element types, required fields)
- Valid element types: `['rectangle', 'circle', 'line', 'arrow', 'pen', 'text', 'note']`
- Check session existence before modifying elements

### Frontend JavaScript (public/app.js)

**Architecture:**
- Use class-based architecture (Whiteboard class)
- Single class pattern with method organization using comment sections
- Event-driven programming with `addEventListener`

**Canvas API:**
- Use proper coordinate transformations for zoom/pan
- Account for device pixel ratio: `window.devicePixelRatio`
- Use `ctx.save()` and `ctx.restore()` for temporary state changes
- Clear and redraw canvas on state changes
- Set `lineCap` and `lineJoin` to 'round' for smooth strokes

**State Management:**
- Store elements in `this.elements` array
- Undo/redo stacks with max 50 entries
- Selection state: `this.selectedElement`, `this.isDragging`
- Zoom/pan state: `this.scale`, `this.offsetX`, `this.offsetY`

**Event Handling:**
- Handle both mouse and touch events for mobile support
- Prevent default on touch events to avoid scrolling
- Throttle cursor position updates (50ms) to reduce WebSocket traffic
- Support keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+/-/0, Space)

**WebSocket Communication:**
- Auto-reconnect on disconnect (3 second delay)
- Send JSON messages with `type` field
- Handle message types: `draw`, `erase`, `clear`, `move`, `reorder`, `cursor`, `userCount`, `userLeft`
- Use `sendMessage()` wrapper for WebSocket communication

**Naming:**
- Classes: PascalCase (`Whiteboard`)
- Methods: camelCase (`handleMouseDown`, `drawRectangle`)
- Constants: UPPER_SNAKE_CASE (`maxHistorySize` - rare in this codebase)
- Event handlers: prefix with `handle` (`handleMouseDown`)
- Drawing methods: prefix with `draw` (`drawRectangle`, `drawElement`)

**Element Structure:**
- All elements require `id` (use `this.generateId()` or `uuid`)
- Required fields vary by type:
  - rectangle: `type`, `x`, `y`, `width`, `height`
  - circle: `type`, `cx`, `cy`, `radius`
  - line: `type`, `x1`, `y1`, `x2`, `y2`
  - arrow: `type`, `x1`, `y1`, `x2`, `y2`, `arrowStyle` ('single' or 'double')
  - pen: `type`, `points` (array of {x, y})
  - text: `type`, `x`, `y`, `text`
  - note: `type`, `x`, `y`, `width`, `height`, `text`
- Optional: `color` (default '#000000'), `strokeWidth` (default 2)

### CSS (public/styles.css)

**Organization:**
- Use CSS custom properties (variables) in `:root` for colors
- Class naming: kebab-case (`.tool-btn`, `.color-palette`)
- Use semantic HTML structure with `<header>`, `<aside>`, etc.

**Styling:**
- Use flexbox for layout
- Responsive design with `@media` queries
- Transitions for smooth UI changes
- CSS variables for consistent theming

**Color Format:**
- Use hex colors (#000000 format)
- Define all colors in `:root` variables

### HTML (public/index.html)

**Structure:**
- Use semantic HTML5 elements
- Include meta viewport tag for mobile: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- Place `<script>` at end of body
- Use data attributes for element metadata: `data-tool`, `data-color`, `data-stroke`

**Accessibility:**
- Include `title` attributes on buttons for tooltips
- Use proper button elements, not divs

### General Conventions

**Variables/Functions:** camelCase (`currentTool`, `handleMouseDown`)
**Classes:** PascalCase (`Whiteboard`)
**Constants:** UPPER_SNAKE_CASE (`PORT`, `DATA_DIR`)
**Colors:** Hex format (#000000)
**Element IDs:** Use uuid library or generateId() method
**Console:** Use console.log for debugging (remove in production)

### File Structure

- `server.js` - Main Express server and WebSocket handler
- `public/app.js` - Frontend whiteboard application (Whiteboard class)
- `public/index.html` - Main HTML template
- `public/styles.css` - All styling rules

### API Patterns

**REST Endpoints:**
- `GET /api/sessions/:sessionId` - Get session info and all elements
- `GET /api/sessions/:sessionId/elements` - Get all elements
- `GET /api/sessions/:sessionId/elements/:elementId` - Get specific element
- `POST /api/sessions/:sessionId/elements` - Create single element
- `POST /api/sessions/:sessionId/elements/batch` - Create multiple elements
- `PUT /api/sessions/:sessionId/elements/:elementId` - Update element
- `DELETE /api/sessions/:sessionId/elements/:elementId` - Delete element
- `DELETE /api/sessions/:sessionId/elements` - Clear all elements
- `GET /api/schema` - Element schema documentation
- `GET /api/agent` - Comprehensive API guide (returns markdown)

**WebSocket Messages:**
- `draw` - Add element
- `erase` - Remove element by ID
- `clear` - Clear all elements
- `move` - Update element position
- `reorder` - Move element to front/back
- `cursor` - Share cursor position
- `userCount` - Update user count
- `userLeft` - User left session

**Session Management:**
- Session IDs extracted from URL path (`/sessionId`)
- WebSocket connections pass session as query param: `?session=sessionId`
- Sessions persist in LMDB, active clients in Map
- Clean up empty sessions after 60 seconds

### Error Handling

**API Errors:**
- Always return JSON with `error` field
- Use appropriate HTTP status codes
- Validate input before processing

**WebSocket Errors:**
- Log errors with `console.error()`
- Attempt reconnection on disconnect
- Gracefully handle malformed JSON

**Frontend Errors:**
- Use try-catch for JSON parsing
- Show toast notifications for user feedback
- Handle missing elements gracefully
