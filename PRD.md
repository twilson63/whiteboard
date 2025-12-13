# Product Requirements Document: Collaborative Web Whiteboard

## Overview

A real-time collaborative whiteboard web application that allows multiple users to draw, add shapes, and create notes together on a shared canvas. Each whiteboard session is accessible via a unique URL, enabling easy sharing and collaboration.

---

## Problem Statement

Teams need a simple, lightweight way to collaborate visually in real-time without requiring account creation or software installation. Existing solutions are often complex, require sign-ups, or lack real-time synchronization.

---

## Goals

1. Enable real-time collaborative drawing and annotation
2. Provide instant sharing via unique session URLs
3. Offer an intuitive, zero-friction user experience
4. Support essential whiteboard tools without complexity

---

## User Stories

### Core User Stories

1. **As a user**, I want to create a new whiteboard session so that I can start collaborating immediately
2. **As a user**, I want to share a URL with others so they can join my whiteboard session
3. **As a user**, I want to draw freehand lines so I can sketch ideas quickly
4. **As a user**, I want to add shapes (rectangles, circles, lines) so I can create diagrams
5. **As a user**, I want to add text notes so I can annotate my drawings
6. **As a user**, I want to erase specific elements so I can correct mistakes
7. **As a user**, I want to clear the entire board so I can start fresh
8. **As a user**, I want to see other users' changes in real-time so we can collaborate effectively

---

## Functional Requirements

### 1. Session Management

| ID | Requirement | Priority |
|----|-------------|----------|
| SM-1 | System shall generate unique session IDs for new whiteboards | Must Have |
| SM-2 | System shall allow access to existing sessions via URL (e.g., `/session/:id`) | Must Have |
| SM-3 | Navigating to root URL (`/`) shall create and redirect to a new session | Must Have |
| SM-4 | Session data shall persist for the duration of active connections | Must Have |
| SM-5 | System shall clean up abandoned sessions after configurable timeout | Should Have |

### 2. Drawing Tools

| ID | Requirement | Priority |
|----|-------------|----------|
| DT-1 | Freehand pen/pencil tool for drawing lines | Must Have |
| DT-2 | Rectangle shape tool | Must Have |
| DT-3 | Circle/ellipse shape tool | Must Have |
| DT-4 | Straight line tool | Must Have |
| DT-5 | Sticky note/text box tool | Must Have |
| DT-6 | Color picker for stroke/fill colors | Must Have |
| DT-7 | Stroke width selector (thin, medium, thick) | Should Have |
| DT-8 | Arrow tool | Nice to Have |

### 3. Editing Tools

| ID | Requirement | Priority |
|----|-------------|----------|
| ET-1 | Eraser tool to remove individual elements | Must Have |
| ET-2 | Clear all button to reset the entire canvas | Must Have |
| ET-3 | Clear all shall require confirmation to prevent accidents | Must Have |
| ET-4 | Undo last action | Should Have |
| ET-5 | Redo action | Should Have |
| ET-6 | Select and move elements | Nice to Have |

### 4. Real-Time Collaboration

| ID | Requirement | Priority |
|----|-------------|----------|
| RT-1 | All drawing actions shall be broadcast to connected users in real-time | Must Have |
| RT-2 | New users joining a session shall receive current canvas state | Must Have |
| RT-3 | System shall handle concurrent edits gracefully | Must Have |
| RT-4 | System shall display count of connected users | Should Have |
| RT-5 | System shall show cursor positions of other users | Nice to Have |
| RT-6 | System shall assign unique colors to differentiate users | Nice to Have |

### 5. Canvas Features

| ID | Requirement | Priority |
|----|-------------|----------|
| CF-1 | Canvas shall be responsive and fill available viewport | Must Have |
| CF-2 | Canvas shall support pan/scroll for larger drawings | Should Have |
| CF-3 | Canvas shall support zoom in/out | Should Have |
| CF-4 | Export canvas as PNG image | Nice to Have |
| CF-5 | Export canvas as SVG | Nice to Have |

---

## Non-Functional Requirements

### Performance

- Real-time updates shall have latency < 100ms under normal network conditions
- Application shall support at least 10 concurrent users per session
- Initial page load shall complete in < 2 seconds
- Drawing shall feel responsive with no perceptible lag locally

### Scalability

- Architecture shall support horizontal scaling
- Session data structure shall be efficient for real-time sync

### Compatibility

- Support modern browsers: Chrome, Firefox, Safari, Edge (latest 2 versions)
- Support desktop and tablet devices
- Touch support for tablet drawing

### Security

- Session IDs shall be sufficiently random to prevent guessing
- No authentication required (anonymous collaboration)
- Consider rate limiting to prevent abuse

---

## Technical Architecture

### Recommended Stack

**Frontend:**
- HTML5 Canvas API for rendering
- Vanilla JavaScript or lightweight framework (e.g., Preact, Svelte)
- CSS for toolbar and UI components

**Backend:**
- Node.js with Express.js for HTTP server
- WebSocket (ws library or Socket.IO) for real-time communication
- In-memory storage for session data (Redis for production scaling)

**Communication Protocol:**
- WebSocket for bidirectional real-time updates
- JSON message format for drawing events

### Data Model

```typescript
// Session
interface Session {
  id: string;
  createdAt: Date;
  elements: DrawingElement[];
  connectedUsers: number;
}

// Base Drawing Element
interface DrawingElement {
  id: string;
  type: 'pen' | 'rectangle' | 'circle' | 'line' | 'note';
  color: string;
  strokeWidth: number;
  createdBy: string; // anonymous user ID
  timestamp: number;
}

// Freehand Drawing
interface PenElement extends DrawingElement {
  type: 'pen';
  points: { x: number; y: number }[];
}

// Shape Elements
interface RectangleElement extends DrawingElement {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
}

interface CircleElement extends DrawingElement {
  type: 'circle';
  cx: number;
  cy: number;
  radius: number;
  fill?: string;
}

interface LineElement extends DrawingElement {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Sticky Note
interface NoteElement extends DrawingElement {
  type: 'note';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  backgroundColor: string;
}

// WebSocket Messages
type WSMessage = 
  | { type: 'draw'; element: DrawingElement }
  | { type: 'erase'; elementId: string }
  | { type: 'clear' }
  | { type: 'sync'; elements: DrawingElement[] }
  | { type: 'userCount'; count: number };
```

---

## User Interface

### Layout

```
+----------------------------------------------------------+
|  [Logo]  Session: abc123    |  Users: 3  |  [Share URL]  |
+----------------------------------------------------------+
|        |                                                  |
|  Tools |                                                  |
|  ----  |                                                  |
|  [Pen] |                                                  |
|  [Rect]|                  CANVAS AREA                     |
|  [Circ]|                                                  |
|  [Line]|                                                  |
|  [Note]|                                                  |
|  ----  |                                                  |
| [Erase]|                                                  |
| [Clear]|                                                  |
|  ----  |                                                  |
| Colors |                                                  |
| [][][]  |                                                  |
+----------------------------------------------------------+
```

### Toolbar Components

1. **Tool Selection** - Radio-style buttons for selecting active tool
2. **Color Palette** - Preset colors + custom color picker
3. **Stroke Width** - Small/Medium/Large toggle
4. **Eraser** - Toggle eraser mode
5. **Clear All** - Button with confirmation dialog
6. **Session Info** - Display session ID and user count
7. **Share Button** - Copy session URL to clipboard

---

## MVP Scope (Phase 1)

For initial release, focus on:

1. Session creation and URL-based sharing
2. Freehand drawing (pen tool)
3. Basic shapes: rectangle, circle, line
4. Sticky notes with text
5. Color selection (preset palette)
6. Eraser tool
7. Clear all functionality
8. Real-time sync via WebSocket
9. Basic responsive canvas

---

## Future Enhancements (Phase 2+)

- User presence indicators (cursors, colors)
- Undo/Redo functionality
- Element selection and movement
- Zoom and pan controls
- Export to PNG/SVG
- Persistent sessions with database storage
- Optional password protection for sessions
- Template whiteboards
- Image upload and placement
- Presentation mode

---

## Success Metrics

1. **Usability**: Users can create and share a whiteboard in < 30 seconds
2. **Performance**: Real-time sync latency < 100ms for 90% of interactions
3. **Reliability**: 99% uptime during collaboration sessions
4. **Adoption**: Track session creation and user join rates

---

## Open Questions

1. Should sessions expire after a certain time of inactivity?
2. Maximum canvas size / element count per session?
3. Should we limit concurrent users per session?
4. Do we need any moderation or abuse prevention features?

---

## Appendix

### Similar Products for Reference

- Excalidraw (excalidraw.com)
- Miro (miro.com)
- FigJam (figma.com/figjam)
- Whiteboard.fi
- Microsoft Whiteboard

### Technology Alternatives

| Component | Primary Choice | Alternative |
|-----------|---------------|-------------|
| Real-time | WebSocket | Socket.IO, Server-Sent Events |
| Canvas | HTML5 Canvas | SVG, Fabric.js, Konva.js |
| Backend | Node.js/Express | Deno, Bun, Go |
| State Sync | Custom | Yjs, Automerge (CRDT libraries) |
