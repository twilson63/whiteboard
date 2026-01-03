# AGENTS.md

## Build & Run Commands

```bash
npm start          # Start production server (port 3000)
npm run dev        # Development server with auto-reload (node --watch)
```

## Testing

No test framework configured. Add tests before implementing new features.

## Project Structure

```
server.js           # Express server + WebSocket handler + LMDB persistence
public/
  app.js            # Frontend Whiteboard class (~2200 lines)
  index.html        # Main HTML template
  styles.css        # All styling rules
```

## Code Style Guidelines

### Module System
- **Backend:** CommonJS `require()` only - no ES6 import/export
- **Frontend:** Class-based architecture (single Whiteboard class)

### Naming Conventions
| Type | Convention | Examples |
|------|------------|----------|
| Functions/Methods | camelCase | `handleMouseDown`, `saveSession` |
| Classes | PascalCase | `Whiteboard` |
| Constants | UPPER_SNAKE_CASE | `PORT`, `DATA_DIR` |
| Event handlers | `handle` prefix | `handleMouseDown`, `handleTouchStart` |
| Drawing methods | `draw` prefix | `drawRectangle`, `drawElement` |
| CSS classes | kebab-case | `.tool-btn`, `.color-palette` |

### Error Handling

**Backend (server.js):**
```javascript
// Always return JSON with error field
res.status(400).json({ error: 'Invalid input message' });
res.status(404).json({ error: 'Session not found' });
res.status(500).json({ error: 'Internal server error' });
```

**Frontend (app.js):**
- Use try-catch for JSON parsing
- Show toast notifications: `this.showToast('Error message')`
- Handle missing elements gracefully

### WebSocket Messages

All messages must be JSON with a `type` field:
```javascript
// Send
this.sendMessage({ type: 'draw', element: element });

// Receive
const message = JSON.parse(event.data);
switch (message.type) {
  case 'draw': // ...
  case 'erase': // ...
}
```

**Message Types:** `draw`, `erase`, `clear`, `move`, `reorder`, `cursor`, `userCount`, `userLeft`, `init`

### Element Structure

All elements require an `id` (use `this.generateId()` or `uuidv4()`).

| Type | Required Fields |
|------|-----------------|
| rectangle | `type`, `x`, `y`, `width`, `height` |
| circle | `type`, `cx`, `cy`, `radius` |
| line | `type`, `x1`, `y1`, `x2`, `y2` |
| arrow | `type`, `x1`, `y1`, `x2`, `y2`, `arrowStyle` ('single'/'double') |
| pen | `type`, `points` (array of {x, y}) |
| text | `type`, `x`, `y`, `text`, `fontSize` |
| note | `type`, `x`, `y`, `width`, `height`, `text` |

**Optional fields:** `color` (default '#000000'), `strokeWidth` (default 2)

**Valid types array:** `['rectangle', 'circle', 'line', 'arrow', 'pen', 'text', 'note']`

### Canvas Rendering

```javascript
// Always use save/restore for temporary state
this.ctx.save();
this.ctx.strokeStyle = element.color;
// ... draw operations
this.ctx.restore();

// Account for device pixel ratio
const dpr = window.devicePixelRatio || 1;

// Use round caps for smooth strokes
this.ctx.lineCap = 'round';
this.ctx.lineJoin = 'round';
```

### State Management (Frontend)

- Elements: `this.elements` array
- Undo/Redo: `this.undoStack`, `this.redoStack` (max 50 entries)
- Selection: `this.selectedElement`, `this.isDragging`
- Zoom/Pan: `this.scale`, `this.offsetX`, `this.offsetY`
- Remote cursors: `this.remoteCursors` Map

### Database (Backend)

- LMDB for persistence, in-memory Map for active sessions
- Save immediately after modifications: `saveSession(sessionId)`
- Clean up empty sessions after 60 seconds of inactivity

## REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions/:sessionId` | Get session info and elements |
| GET | `/api/sessions/:sessionId/elements` | Get all elements |
| GET | `/api/sessions/:sessionId/elements/:id` | Get specific element |
| POST | `/api/sessions/:sessionId/elements` | Create element |
| POST | `/api/sessions/:sessionId/elements/batch` | Create multiple elements |
| PUT | `/api/sessions/:sessionId/elements/:id` | Update element |
| DELETE | `/api/sessions/:sessionId/elements/:id` | Delete element |
| DELETE | `/api/sessions/:sessionId/elements` | Clear all elements |
| GET | `/api/schema` | Element schema documentation |
| GET | `/api/agent` | Comprehensive API guide (markdown) |

## Keyboard Shortcuts

**Tools:** H (Pan/Hand), V (Select), P (Pen), L (Line), A (Arrow), R (Rectangle), C (Circle), N (Note), T (Text), E (Eraser)

**Actions:** Ctrl+Z (Undo), Ctrl+Shift+Z/Ctrl+Y (Redo), Delete (Delete selected), Ctrl++/- (Zoom), Ctrl+0 (Reset zoom), Space+Drag (Pan)

## CSS Organization

- CSS variables in `:root` for theming
- Toolbar structure: `.toolbar-row` > `.toolbar-group` > `.tool-btn`
- Contextual options: `.context-options[data-context="arrow"]` with `.visible` class
- Use flexbox for layouts, transitions for animations

## Key Patterns

### Adding a New Tool
1. Add button in `index.html` with `data-tool="toolname"`
2. Add case in `selectTool()` method
3. Handle in `startDrawing()`, `continueDrawing()`, `endDrawing()`
4. Add drawing method `drawToolname()` and `drawElement()` case
5. Update `isPointNearElement()` for hit detection
6. Add to valid types array in server.js

### Adding a New Element Property
1. Update element creation in frontend
2. Update `drawElement()` to use the property
3. Update server.js validation if needed
4. Update `/api/schema` endpoint documentation

### Touch/Mobile Support
- Handle both mouse and touch events
- Prevent default on touch to avoid scrolling
- Throttle cursor updates (50ms) to reduce WebSocket traffic
