# Feature: Horizontal Top Toolbar Redesign

## Overview

Redesign the current vertical sidebar toolbar into a horizontal top toolbar with a contextual options bar. This improves usability by eliminating scrolling, grouping related tools, and showing context-sensitive options.

## Current Problems

- Very long vertical sidebar that requires scrolling
- Tool options (colors, stroke, arrow style, zoom) are buried at the bottom, out of view
- Mixed concerns: drawing tools, editing tools, history, layers, and tool options all in one sidebar
- No visual grouping or hierarchy
- Context-specific options (like arrow style) are always visible even when not relevant
- Missing keyboard shortcuts for tool selection

## Target Layout

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Whiteboard  Session: foo  │ ↶ ↷ │ [◇][✎][/][→][□][○][📝][T] │ [🧹][🗑] │ Users │ Share │
├────────────────────────────────────────────────────────────────────────────────┤
│ Color: ● ● ● ● ● ● ● ●  │ Stroke: [2][4][8] │ Arrow: [→][↔] │ Zoom: [-][100%][+] │ Export │
└────────────────────────────────────────────────────────────────────────────────┘
│                                                                                │
│                              [Canvas Area]                                     │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Files to Modify

- `public/index.html` - Restructure HTML layout
- `public/styles.css` - New toolbar styles, remove sidebar styles
- `public/app.js` - Add contextual options logic and keyboard shortcuts
- `server.js` - Update `/api/agent` documentation
- `AGENTS.md` - Update code style documentation

---

## Task 1: HTML Structure Refactor

**File:** `public/index.html`
**Can run in parallel with:** Task 2, Task 4, Task 6, Task 7

### Instructions

1. **Remove the `<aside class="toolbar">` element** (lines 26-221)

2. **Expand the header** to include two rows:
   - **Row 1 (Primary Toolbar):** Logo, session ID, divider, undo/redo, divider, drawing tools, divider, edit tools, spacer, user count, share button
   - **Row 2 (Options Bar):** Colors, stroke width, contextual options (arrow style, layer controls), spacer, zoom controls, export buttons

3. **New HTML structure for header:**

```html
<header class="header">
  <!-- Row 1: Primary Toolbar -->
  <div class="toolbar-row primary-toolbar">
    <div class="toolbar-group brand">
      <h1 class="logo">Whiteboard</h1>
      <span class="session-id" id="sessionId"></span>
    </div>
    
    <div class="toolbar-divider"></div>
    
    <div class="toolbar-group history">
      <button class="tool-btn disabled" id="undoBtn" title="Undo (Ctrl+Z)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 7v6h6"/>
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13"/>
        </svg>
      </button>
      <button class="tool-btn disabled" id="redoBtn" title="Redo (Ctrl+Shift+Z)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 7v6h-6"/>
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64L21 13"/>
        </svg>
      </button>
    </div>
    
    <div class="toolbar-divider"></div>
    
    <div class="toolbar-group tools">
      <button class="tool-btn" data-tool="select" title="Select (V)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
          <path d="M13 13l6 6"/>
        </svg>
      </button>
      <button class="tool-btn active" data-tool="pen" title="Pen (P)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
          <path d="M2 2l7.586 7.586"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="line" title="Line (L)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="19" x2="19" y2="5"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="arrow" title="Arrow (A)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="rectangle" title="Rectangle (R)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="circle" title="Circle (C)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="note" title="Sticky Note (N)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </button>
      <button class="tool-btn" data-tool="text" title="Text (T)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="4 7 4 4 20 4 20 7"/>
          <line x1="9" y1="20" x2="15" y2="20"/>
          <line x1="12" y1="4" x2="12" y2="20"/>
        </svg>
      </button>
    </div>
    
    <div class="toolbar-divider"></div>
    
    <div class="toolbar-group edit">
      <button class="tool-btn" data-tool="eraser" title="Eraser (E)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.8 1.4c.8-.8 2-.8 2.8 0l5 5c.8.8.8 2 0 2.8L11 20"/>
          <path d="M18 13L11 6"/>
        </svg>
      </button>
      <button class="tool-btn danger" id="clearBtn" title="Clear All">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      </button>
    </div>
    
    <div class="toolbar-spacer"></div>
    
    <div class="toolbar-group session-info">
      <span class="user-count" id="userCount">Users: 1</span>
      <button class="btn btn-share" id="shareBtn">Share</button>
    </div>
  </div>
  
  <!-- Row 2: Options Bar -->
  <div class="toolbar-row options-bar">
    <div class="toolbar-group colors">
      <span class="option-label">Color</span>
      <div class="color-palette">
        <button class="color-btn active" data-color="#000000" style="background-color: #000000" title="Black"></button>
        <button class="color-btn" data-color="#e74c3c" style="background-color: #e74c3c" title="Red"></button>
        <button class="color-btn" data-color="#3498db" style="background-color: #3498db" title="Blue"></button>
        <button class="color-btn" data-color="#2ecc71" style="background-color: #2ecc71" title="Green"></button>
        <button class="color-btn" data-color="#f39c12" style="background-color: #f39c12" title="Orange"></button>
        <button class="color-btn" data-color="#9b59b6" style="background-color: #9b59b6" title="Purple"></button>
        <button class="color-btn" data-color="#1abc9c" style="background-color: #1abc9c" title="Teal"></button>
        <button class="color-btn" data-color="#34495e" style="background-color: #34495e" title="Dark Gray"></button>
      </div>
    </div>
    
    <div class="toolbar-divider"></div>
    
    <div class="toolbar-group strokes">
      <span class="option-label">Stroke</span>
      <div class="stroke-options">
        <button class="stroke-btn" data-stroke="2" title="Thin">
          <span class="stroke-preview" style="height: 2px"></span>
        </button>
        <button class="stroke-btn active" data-stroke="4" title="Medium">
          <span class="stroke-preview" style="height: 4px"></span>
        </button>
        <button class="stroke-btn" data-stroke="8" title="Thick">
          <span class="stroke-preview" style="height: 8px"></span>
        </button>
      </div>
    </div>
    
    <div class="toolbar-divider"></div>
    
    <!-- Contextual: Arrow options (hidden by default, shown when arrow tool selected) -->
    <div class="toolbar-group arrow-options context-options" data-context="arrow">
      <span class="option-label">Arrow</span>
      <div class="arrow-style-options">
        <button class="arrow-style-btn active" data-arrow-style="single" title="Single-headed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
        <button class="arrow-style-btn" data-arrow-style="double" title="Double-headed">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
            <polyline points="12 5 5 12 12 19"/>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- Contextual: Layer options (hidden by default, shown when select tool active and element selected) -->
    <div class="toolbar-group layer-options context-options" data-context="select">
      <span class="option-label">Layer</span>
      <button class="tool-btn" id="moveToFrontBtn" title="Move to Front">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="8" y="8" width="12" height="12" rx="1"/>
          <path d="M4 16V6a2 2 0 0 1 2-2h10"/>
        </svg>
      </button>
      <button class="tool-btn" id="moveToBackBtn" title="Move to Back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="12" height="12" rx="1"/>
          <path d="M8 20h10a2 2 0 0 0 2-2V8"/>
        </svg>
      </button>
    </div>
    
    <div class="toolbar-spacer"></div>
    
    <div class="toolbar-group zoom">
      <button class="tool-btn" id="zoomOutBtn" title="Zoom Out (Ctrl+-)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <span class="zoom-level" id="zoomLevel">100%</span>
      <button class="tool-btn" id="zoomInBtn" title="Zoom In (Ctrl++)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>
      <button class="tool-btn" id="zoomResetBtn" title="Reset Zoom (Ctrl+0)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
    </div>
    
    <div class="toolbar-divider"></div>
    
    <div class="toolbar-group export">
      <button class="tool-btn" id="exportPngBtn" title="Export as PNG">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </button>
      <button class="tool-btn" id="exportSvgBtn" title="Export as SVG">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M9 15l2 2 4-4"/>
        </svg>
      </button>
    </div>
  </div>
</header>
```

4. **Update main content structure** - Remove sidebar reference:

```html
<div class="main">
  <div class="canvas-container" id="canvasContainer">
    <canvas id="whiteboard"></canvas>
  </div>
</div>
```

5. **Keep all modals unchanged** (noteModal, textModal, clearModal, toast)

---

## Task 2: CSS Styling

**File:** `public/styles.css`
**Can run in parallel with:** Task 1, Task 4, Task 6, Task 7

### Instructions

1. **Remove old sidebar styles** (lines 132-298):
   - `.toolbar` (vertical sidebar)
   - `.tool-section`
   - `.section-label`
   - Old vertical `.color-palette`, `.stroke-options`, `.arrow-style-options` styles

2. **Update header styles** - Replace existing `.header` styles with:

```css
/* Header with dual toolbar rows */
.header {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
  z-index: 100;
}

/* Toolbar rows */
.toolbar-row {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  gap: 0.5rem;
}

.primary-toolbar {
  border-bottom: 1px solid var(--border);
}

.options-bar {
  background-color: var(--bg-primary);
  padding: 0.375rem 1rem;
}

/* Toolbar groups */
.toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.toolbar-group.brand {
  gap: 0.75rem;
}

/* Dividers and spacers */
.toolbar-divider {
  width: 1px;
  height: 24px;
  background-color: var(--border);
  margin: 0 0.5rem;
}

.toolbar-spacer {
  flex: 1;
}
```

3. **Update tool button styles:**

```css
/* Tool buttons (horizontal layout) */
.tool-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 6px;
  background-color: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.tool-btn svg {
  width: 20px;
  height: 20px;
}

.tool-btn:hover {
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.tool-btn.active {
  background-color: var(--accent);
  color: var(--text-light);
}

.tool-btn.danger:hover {
  background-color: var(--danger);
  color: var(--text-light);
}

.tool-btn.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tool-btn.disabled:hover {
  background-color: transparent;
  color: var(--text-secondary);
}
```

4. **Add option label styles:**

```css
/* Option labels */
.option-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-right: 0.5rem;
  font-weight: 500;
}
```

5. **Update color palette for horizontal layout:**

```css
/* Color palette (horizontal) */
.color-palette {
  display: flex;
  gap: 4px;
}

.color-btn {
  width: 22px;
  height: 22px;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.color-btn:hover {
  transform: scale(1.15);
}

.color-btn.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.3);
}
```

6. **Update stroke options for horizontal layout:**

```css
/* Stroke options (horizontal) */
.stroke-options {
  display: flex;
  gap: 4px;
}

.stroke-btn {
  width: 40px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background-color: var(--bg-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  transition: all 0.15s;
}

.stroke-btn:hover {
  border-color: var(--accent);
}

.stroke-btn.active {
  border-color: var(--accent);
  background-color: rgba(52, 152, 219, 0.1);
}

.stroke-preview {
  width: 100%;
  background-color: var(--text-primary);
  border-radius: 2px;
}
```

7. **Update arrow style options for horizontal layout:**

```css
/* Arrow style options (horizontal) */
.arrow-style-options {
  display: flex;
  gap: 4px;
}

.arrow-style-btn {
  width: 36px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background-color: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.arrow-style-btn svg {
  width: 18px;
  height: 18px;
}

.arrow-style-btn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.arrow-style-btn.active {
  border-color: var(--accent);
  background-color: rgba(52, 152, 219, 0.1);
  color: var(--accent);
}
```

8. **Add contextual options styles:**

```css
/* Contextual options - hidden by default */
.context-options {
  display: none;
}

.context-options.visible {
  display: flex;
}
```

9. **Update zoom level styles:**

```css
/* Zoom level */
.zoom-level {
  font-size: 0.75rem;
  color: var(--text-secondary);
  min-width: 45px;
  text-align: center;
}
```

10. **Update main content area** (full width now):

```css
/* Main content - full width without sidebar */
.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.canvas-container {
  flex: 1;
  width: 100%;
}
```

11. **Update responsive styles:**

```css
@media (max-width: 768px) {
  .toolbar-row {
    padding: 0.375rem 0.5rem;
    flex-wrap: wrap;
  }
  
  .toolbar-group.brand .logo {
    font-size: 1rem;
  }
  
  .session-id {
    display: none;
  }
  
  .tool-btn {
    width: 32px;
    height: 32px;
  }
  
  .tool-btn svg {
    width: 18px;
    height: 18px;
  }
  
  .option-label {
    display: none;
  }
  
  .toolbar-divider {
    height: 20px;
  }
}

@media (max-width: 480px) {
  .options-bar {
    overflow-x: auto;
    flex-wrap: nowrap;
  }
  
  .toolbar-group.export {
    display: none;
  }
  
  .toolbar-group.zoom .tool-btn:not(#zoomInBtn):not(#zoomOutBtn) {
    display: none;
  }
}
```

---

## Task 3: JavaScript Contextual Options Logic

**File:** `public/app.js`
**Must run after:** Task 1 and Task 2 are complete

### Instructions

1. **Add `updateContextualOptions` method** to the Whiteboard class:

```javascript
updateContextualOptions(tool) {
  // Hide all contextual options
  document.querySelectorAll('.context-options').forEach(el => {
    el.classList.remove('visible');
  });
  
  // Show relevant contextual options based on tool
  const contextMap = {
    'arrow': 'arrow',
    'select': 'select'
  };
  
  const context = contextMap[tool];
  if (context) {
    const contextEl = document.querySelector(`.context-options[data-context="${context}"]`);
    if (contextEl) {
      contextEl.classList.add('visible');
    }
  }
}
```

2. **Update the `selectTool` method** - Add call to `updateContextualOptions`:

Find the `selectTool` method and add at the end:

```javascript
this.updateContextualOptions(tool);
```

3. **Call `updateContextualOptions` on initialization** - In the constructor or init method, after setting up event listeners:

```javascript
// Initialize contextual options visibility
this.updateContextualOptions(this.currentTool);
```

4. **Verify all button selectors still work** - These selectors should remain compatible:
   - `document.querySelectorAll('.tool-btn[data-tool]')`
   - `document.querySelectorAll('.color-btn')`
   - `document.querySelectorAll('.stroke-btn')`
   - `document.querySelectorAll('.arrow-style-btn')`
   - All `getElementById` calls

---

## Task 4: Documentation Update (AGENTS.md)

**File:** `AGENTS.md`
**Can run in parallel with:** Task 1, Task 2, Task 6, Task 7

### Instructions

1. **Update the HTML section** to document new structure:

```markdown
### HTML (public/index.html)

**Structure:**
- Use semantic HTML5 elements
- Header contains two toolbar rows: primary-toolbar and options-bar
- Primary toolbar: brand, history, tools, edit, session info
- Options bar: colors, stroke, contextual options, zoom, export
- Use `data-context` attribute for contextual option groups
- Place `<script>` at end of body

**Toolbar Organization:**
- `.toolbar-row` - Horizontal row container
- `.toolbar-group` - Groups related buttons
- `.toolbar-divider` - Visual separator between groups
- `.toolbar-spacer` - Flexible space to push items to edges
- `.context-options` - Hidden by default, shown based on active tool
```

2. **Update the CSS section:**

```markdown
### CSS (public/styles.css)

**Toolbar Classes:**
- `.toolbar-row` - Flex row for toolbar items
- `.primary-toolbar` - Top row with tools
- `.options-bar` - Second row with options
- `.toolbar-group` - Container for related buttons
- `.context-options` - Contextual options, use `.visible` to show
```

3. **Add keyboard shortcuts section:**

```markdown
### Keyboard Shortcuts

**Tool Selection:**
- V - Select tool
- P - Pen tool
- L - Line tool
- A - Arrow tool
- R - Rectangle tool
- C - Circle tool
- N - Note tool
- T - Text tool
- E - Eraser tool

**Actions:**
- Ctrl+Z - Undo
- Ctrl+Shift+Z / Ctrl+Y - Redo
- Delete/Backspace - Delete selected element
- Ctrl++ - Zoom in
- Ctrl+- - Zoom out
- Ctrl+0 - Reset zoom
- Space+Drag - Pan canvas
```

---

## Task 5: Testing & Verification

**Must run after:** Tasks 1, 2, 3, 7 are complete

### Manual Testing Checklist

**Tool Selection:**
- [ ] All 8 drawing tools selectable via click
- [ ] Active state visible on selected tool
- [ ] Eraser and Clear buttons work

**Contextual Options:**
- [ ] Arrow options appear only when arrow tool selected
- [ ] Layer options appear only when select tool active
- [ ] Options hide when switching to other tools

**Color & Stroke:**
- [ ] All 8 colors selectable
- [ ] Active state visible on selected color
- [ ] All 3 stroke widths selectable
- [ ] Stroke preview visible in buttons

**History & Zoom:**
- [ ] Undo/Redo buttons work
- [ ] Undo/Redo disabled state correct
- [ ] Zoom in/out/reset work
- [ ] Zoom percentage updates

**Export:**
- [ ] PNG export works
- [ ] SVG export works

**Keyboard Shortcuts:**
- [ ] V selects Select tool
- [ ] P selects Pen tool
- [ ] L selects Line tool
- [ ] A selects Arrow tool
- [ ] R selects Rectangle tool
- [ ] C selects Circle tool
- [ ] N selects Note tool
- [ ] T selects Text tool
- [ ] E selects Eraser tool
- [ ] Delete/Backspace removes selected element
- [ ] Shortcuts don't fire when typing in text inputs
- [ ] Ctrl+Z/Y undo/redo work
- [ ] Ctrl++/-/0 zoom shortcuts work
- [ ] Space+drag pans canvas

**Responsive:**
- [ ] Toolbar usable at 768px width
- [ ] Toolbar usable at 480px width
- [ ] No horizontal scroll on primary toolbar
- [ ] Options bar scrollable on very small screens

**Drawing:**
- [ ] All tools draw correctly on canvas
- [ ] Selection and dragging work
- [ ] WebSocket sync still works
- [ ] Multi-user cursors visible

---

## Task 6: Update API Agent Documentation

**File:** `server.js`
**Can run in parallel with:** Task 1, Task 2, Task 4, Task 7

### Instructions

1. **Locate the `/api/agent` route** in `server.js` (~line 396)

2. **Add a "User Interface" section** after the "Quick Start" section in the markdown template:

```markdown
## User Interface

The whiteboard features a horizontal toolbar design for easy access to all tools.

### Primary Toolbar (Top Row)

| Group | Contents |
|-------|----------|
| Brand | Logo, Session ID |
| History | Undo, Redo |
| Drawing Tools | Select, Pen, Line, Arrow, Rectangle, Circle, Note, Text |
| Edit Tools | Eraser, Clear All |
| Session | User count, Share button |

### Options Bar (Second Row)

| Group | Contents |
|-------|----------|
| Colors | 8 preset colors (Black, Red, Blue, Green, Orange, Purple, Teal, Dark Gray) |
| Stroke | Thin (2px), Medium (4px), Thick (8px) |
| Contextual | Tool-specific options (e.g., arrow style when arrow tool selected) |
| Zoom | Zoom out, percentage, Zoom in, Reset |
| Export | PNG, SVG export buttons |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| P | Pen tool |
| L | Line tool |
| A | Arrow tool |
| R | Rectangle tool |
| C | Circle tool |
| N | Note tool |
| T | Text tool |
| E | Eraser tool |
| Delete | Delete selected element |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl++ | Zoom in |
| Ctrl+- | Zoom out |
| Ctrl+0 | Reset zoom |
| Space+Drag | Pan canvas |
```

3. **Update any references** to "sidebar" or "left toolbar" to say "toolbar" instead

---

## Task 7: Implement Tool Keyboard Shortcuts

**File:** `public/app.js`
**Can run in parallel with:** Task 1, Task 2, Task 4, Task 6

### Instructions

1. **Locate the keydown event listener** (~line 222 in current code)

2. **Add tool shortcuts** after the zoom shortcuts block, before the closing `});`:

```javascript
// Tool selection shortcuts (only when not in input fields and no modifier keys)
const toolShortcuts = {
  'v': 'select',
  'p': 'pen',
  'l': 'line',
  'a': 'arrow',
  'r': 'rectangle',
  'c': 'circle',
  'n': 'note',
  't': 'text',
  'e': 'eraser'
};

const tool = toolShortcuts[e.key.toLowerCase()];
if (tool && !e.ctrlKey && !e.metaKey && !e.altKey) {
  e.preventDefault();
  this.selectTool(tool);
  
  // Update UI to reflect tool selection
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  
  // Update contextual options
  this.updateContextualOptions(tool);
}

// Delete selected element with Delete or Backspace
if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedElement) {
  e.preventDefault();
  this.deleteSelectedElement();
}
```

3. **Add `deleteSelectedElement` method** if it doesn't exist:

```javascript
deleteSelectedElement() {
  if (!this.selectedElement) return;
  
  const elementId = this.selectedElement.id;
  
  // Remove from elements array
  this.elements = this.elements.filter(el => el.id !== elementId);
  
  // Save state for undo
  this.saveState();
  
  // Send erase message via WebSocket
  this.sendMessage({
    type: 'erase',
    elementId: elementId
  });
  
  // Clear selection
  this.selectedElement = null;
  
  // Redraw
  this.redraw();
}
```

4. **Verify the method integrates with existing code:**
   - Check if there's already an erase/delete method to reuse
   - Ensure WebSocket message format matches existing `erase` type
   - Ensure undo/redo state is properly saved

---

## Execution Order

```
Phase 1 (Parallel):
├── Task 1: HTML Structure (index.html)
├── Task 2: CSS Styling (styles.css)
├── Task 4: Documentation (AGENTS.md)
├── Task 6: API Agent Documentation (server.js /api/agent)
└── Task 7: Tool Keyboard Shortcuts (app.js)

Phase 2 (Sequential):
└── Task 3: JavaScript Contextual Options Logic (depends on HTML/CSS)

Phase 3 (Sequential):
└── Task 5: Testing & Verification
```

## Success Criteria

- [ ] No vertical scrolling required to access any tool
- [ ] Contextual options only appear when relevant
- [ ] All existing functionality preserved
- [ ] Mobile-friendly at 768px and 480px breakpoints
- [ ] Clean visual hierarchy with grouped related tools
- [ ] All keyboard shortcuts working
- [ ] API documentation updated with UI and shortcuts info
