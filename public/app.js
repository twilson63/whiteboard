// ============================================================
// Collaborative Whiteboard Application
// ============================================================

class Whiteboard {
  constructor() {
    // Canvas setup
    this.canvas = document.getElementById('whiteboard');
    this.ctx = this.canvas.getContext('2d');
    this.canvasContainer = document.getElementById('canvasContainer');
    
    // State
    this.elements = [];
    this.currentTool = 'pen';
    this.currentColor = '#000000';
    this.strokeWidth = 4;
    
    // Arrow style state
    this.arrowStyle = 'single';  // 'single' or 'double'
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentPath = [];
    this.userId = null;
    this.sessionId = this.getSessionId();
    
    // WebSocket
    this.ws = null;
    
    // Note placement
    this.pendingNotePosition = null;
    
    // Text placement
    this.pendingTextPosition = null;
    
    // Selection state
    this.selectedElement = null;
    this.isDragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    
    // Resize state
    this.isResizing = false;
    this.resizeHandle = null; // 'nw', 'ne', 'sw', 'se'
    this.resizeStartBounds = null;
    
    // Undo/Redo stacks
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistorySize = 50;
    
    // Zoom and Pan state
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.minScale = 0.1;
    this.maxScale = 5;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.spacePressed = false;
    
    // Remote cursors
    this.remoteCursors = new Map();
    this.cursorColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#16a085'];
    this.cursorUpdateThrottle = 50; // ms
    this.lastCursorUpdate = 0;
    
    // Initialize
    this.init();
  }

  getSessionId() {
    const path = window.location.pathname;
    return path.substring(1) || null;
  }

  init() {
    this.setupCanvas();
    this.setupEventListeners();
    this.updateContextualOptions(this.currentTool);
    this.connectWebSocket();
    this.updateSessionDisplay();
    this.updateUndoRedoButtons();
    this.updateZoomDisplay();
  }

  // ============================================================
  // Canvas Setup
  // ============================================================

  setupCanvas() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const rect = this.canvasContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    
    // Don't scale here - redraw handles the transform
    this.redraw();
  }

  // ============================================================
  // Event Listeners
  // ============================================================

  setupEventListeners() {
    // Canvas events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    
    // Touch events
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    
    // Tool buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => this.selectTool(btn.dataset.tool));
    });
    
    // Color buttons
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectColor(btn.dataset.color));
    });
    
    // Stroke buttons
    document.querySelectorAll('.stroke-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectStroke(parseInt(btn.dataset.stroke)));
    });
    
    // Arrow style buttons
    document.querySelectorAll('.arrow-style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.arrowStyle = btn.dataset.arrowStyle;
        
        document.querySelectorAll('.arrow-style-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.arrowStyle === this.arrowStyle);
        });
      });
    });
    
    // Clear button
    document.getElementById('clearBtn').addEventListener('click', () => {
      document.getElementById('clearModal').classList.add('active');
    });
    
    // Clear modal
    document.getElementById('clearCancelBtn').addEventListener('click', () => {
      document.getElementById('clearModal').classList.remove('active');
    });
    
    document.getElementById('clearConfirmBtn').addEventListener('click', () => {
      this.clearAll();
      document.getElementById('clearModal').classList.remove('active');
    });
    
    // Note modal
    document.getElementById('noteCancelBtn').addEventListener('click', () => {
      document.getElementById('noteModal').classList.remove('active');
      this.pendingNotePosition = null;
    });
    
    document.getElementById('noteSaveBtn').addEventListener('click', () => {
      this.saveNote();
    });
    
    document.getElementById('noteText').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        this.saveNote();
      }
    });
    
    // Text modal
    document.getElementById('textCancelBtn').addEventListener('click', () => {
      document.getElementById('textModal').classList.remove('active');
      this.pendingTextPosition = null;
    });
    
    document.getElementById('textSaveBtn').addEventListener('click', () => {
      this.saveText();
    });
    
    document.getElementById('textInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.saveText();
      }
    });
    
    // Share button
    document.getElementById('shareBtn').addEventListener('click', () => {
      this.shareLink();
    });
    
    // Layer buttons
    document.getElementById('moveToFrontBtn').addEventListener('click', () => {
      this.moveToFront();
    });
    
    document.getElementById('moveToBackBtn').addEventListener('click', () => {
      this.moveToBack();
    });
    
    // Undo/Redo buttons
    document.getElementById('undoBtn').addEventListener('click', () => {
      this.undo();
    });
    
    document.getElementById('redoBtn').addEventListener('click', () => {
      this.redo();
    });
    
    // Keyboard shortcuts for undo/redo and pan
    document.addEventListener('keydown', (e) => {
      // Check if we're in a text input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        this.redo();
      }
      
      // Space key for pan mode
      if (e.code === 'Space' && !this.spacePressed) {
        this.spacePressed = true;
        this.canvasContainer.classList.add('pan-mode');
      }
      
      // Keyboard zoom shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        this.zoomIn();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        this.zoomOut();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        this.resetZoom();
      }
    });
    
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spacePressed = false;
        this.canvasContainer.classList.remove('pan-mode');
        if (this.isPanning) {
          this.isPanning = false;
        }
      }
    });
    
    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Zoom towards mouse position
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomAtPoint(mouseX, mouseY, zoomFactor);
    }, { passive: false });
    
    // Zoom buttons
    document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
    document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
    document.getElementById('zoomResetBtn').addEventListener('click', () => this.resetZoom());
    
    // Export buttons
    document.getElementById('exportPngBtn').addEventListener('click', () => this.exportAsPng());
    document.getElementById('exportSvgBtn').addEventListener('click', () => this.exportAsSvg());
    
    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  }

  // ============================================================
  // Tool Selection
  // ============================================================

  selectTool(tool) {
    this.currentTool = tool;
    
    // Clear selection when switching tools
    if (tool !== 'select') {
      this.selectedElement = null;
      this.redraw();
    }
    
    // Update UI
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    
    // Update cursor mode
    this.canvasContainer.classList.remove('eraser-mode', 'select-mode', 'dragging');
    if (tool === 'eraser') {
      this.canvasContainer.classList.add('eraser-mode');
    } else if (tool === 'select') {
      this.canvasContainer.classList.add('select-mode');
    }

    this.updateContextualOptions(tool);
  }

  updateContextualOptions(tool) {
    document.querySelectorAll('.context-options').forEach(el => {
      el.classList.remove('visible');
    });
    
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

  selectColor(color) {
    this.currentColor = color;
    
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === color);
    });
  }

  selectStroke(width) {
    this.strokeWidth = width;
    
    document.querySelectorAll('.stroke-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.stroke) === width);
    });
  }

  // ============================================================
  // Mouse/Touch Handlers
  // ============================================================

  getCanvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Convert screen coordinates to canvas coordinates (accounting for zoom and pan)
    return {
      x: (screenX - this.offsetX) / this.scale,
      y: (screenY - this.offsetY) / this.scale
    };
  }
  
  getScreenPoint(canvasX, canvasY) {
    // Convert canvas coordinates to screen coordinates
    return {
      x: canvasX * this.scale + this.offsetX,
      y: canvasY * this.scale + this.offsetY
    };
  }

  handleMouseDown(e) {
    // Handle pan mode (space + drag or middle mouse button)
    if (this.spacePressed || e.button === 1) {
      this.isPanning = true;
      this.panStartX = e.clientX - this.offsetX;
      this.panStartY = e.clientY - this.offsetY;
      this.canvasContainer.classList.add('panning');
      e.preventDefault();
      return;
    }
    
    const point = this.getCanvasPoint(e);
    this.startDrawing(point);
  }

  handleMouseMove(e) {
    // Handle panning
    if (this.isPanning) {
      this.offsetX = e.clientX - this.panStartX;
      this.offsetY = e.clientY - this.panStartY;
      this.redraw();
      return;
    }
    
    const point = this.getCanvasPoint(e);
    
    // Send cursor position to other users (throttled)
    this.sendCursorPosition(point);
    
    this.continueDrawing(point);
  }
  
  sendCursorPosition(point) {
    const now = Date.now();
    if (now - this.lastCursorUpdate < this.cursorUpdateThrottle) {
      return;
    }
    this.lastCursorUpdate = now;
    
    this.sendMessage({
      type: 'cursor',
      x: point.x,
      y: point.y
    });
  }

  handleMouseUp(e) {
    // End panning
    if (this.isPanning) {
      this.isPanning = false;
      this.canvasContainer.classList.remove('panning');
      return;
    }
    
    const point = this.getCanvasPoint(e);
    this.endDrawing(point);
  }

  handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const point = this.getCanvasPoint(touch);
      this.startDrawing(point);
    }
  }

  handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const point = this.getCanvasPoint(touch);
      this.continueDrawing(point);
    }
  }

  handleTouchEnd(e) {
    e.preventDefault();
    this.endDrawing({ x: this.startX, y: this.startY });
  }

  // ============================================================
  // Drawing Logic
  // ============================================================

  startDrawing(point) {
    this.isDrawing = true;
    this.startX = point.x;
    this.startY = point.y;
    
    if (this.currentTool === 'select') {
      this.handleSelectStart(point);
      this.isDrawing = false;
    } else if (this.currentTool === 'pen') {
      this.currentPath = [{ x: point.x, y: point.y }];
    } else if (this.currentTool === 'eraser') {
      this.eraseAt(point);
    } else if (this.currentTool === 'note') {
      this.pendingNotePosition = { x: point.x, y: point.y };
      document.getElementById('noteText').value = '';
      document.getElementById('noteModal').classList.add('active');
      document.getElementById('noteText').focus();
      this.isDrawing = false;
    } else if (this.currentTool === 'text') {
      this.pendingTextPosition = { x: point.x, y: point.y };
      document.getElementById('textInput').value = '';
      document.getElementById('textModal').classList.add('active');
      document.getElementById('textInput').focus();
      this.isDrawing = false;
    }
  }

  continueDrawing(point) {
    // Handle dragging or resizing for select tool
    if (this.currentTool === 'select' && (this.isDragging || this.isResizing)) {
      this.handleSelectDrag(point);
      return;
    }
    
    if (!this.isDrawing) return;
    
    if (this.currentTool === 'pen') {
      this.currentPath.push({ x: point.x, y: point.y });
      this.redraw();
      this.drawPenPreview();
    } else if (this.currentTool === 'eraser') {
      this.eraseAt(point);
    } else if (['line', 'arrow', 'rectangle', 'circle'].includes(this.currentTool)) {
      this.redraw();
      this.drawShapePreview(point);
    }
  }

  endDrawing(point) {
    // Handle end of dragging or resizing for select tool
    if (this.currentTool === 'select' && (this.isDragging || this.isResizing)) {
      this.handleSelectEnd(point);
      return;
    }
    
    if (!this.isDrawing) return;
    this.isDrawing = false;
    
    let element = null;
    
    if (this.currentTool === 'pen' && this.currentPath.length > 1) {
      element = {
        id: this.generateId(),
        type: 'pen',
        points: [...this.currentPath],
        color: this.currentColor,
        strokeWidth: this.strokeWidth
      };
    } else if (this.currentTool === 'line') {
      element = {
        id: this.generateId(),
        type: 'line',
        x1: this.startX,
        y1: this.startY,
        x2: point.x,
        y2: point.y,
        color: this.currentColor,
        strokeWidth: this.strokeWidth
      };
    } else if (this.currentTool === 'arrow') {
      element = {
        id: this.generateId(),
        type: 'arrow',
        x1: this.startX,
        y1: this.startY,
        x2: point.x,
        y2: point.y,
        color: this.currentColor,
        strokeWidth: this.strokeWidth,
        arrowStyle: this.arrowStyle
      };
    } else if (this.currentTool === 'rectangle') {
      element = {
        id: this.generateId(),
        type: 'rectangle',
        x: Math.min(this.startX, point.x),
        y: Math.min(this.startY, point.y),
        width: Math.abs(point.x - this.startX),
        height: Math.abs(point.y - this.startY),
        color: this.currentColor,
        strokeWidth: this.strokeWidth
      };
    } else if (this.currentTool === 'circle') {
      const radius = Math.sqrt(
        Math.pow(point.x - this.startX, 2) + 
        Math.pow(point.y - this.startY, 2)
      );
      element = {
        id: this.generateId(),
        type: 'circle',
        cx: this.startX,
        cy: this.startY,
        radius: radius,
        color: this.currentColor,
        strokeWidth: this.strokeWidth
      };
    }
    
    if (element) {
      this.elements.push(element);
      this.sendMessage({ type: 'draw', element });
      this.saveToHistory({ type: 'add', element });
      this.redraw();
    }
    
    this.currentPath = [];
  }

  // ============================================================
  // Drawing Rendering
  // ============================================================

  redraw() {
    const rect = this.canvasContainer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Clear the entire canvas
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    
    // Apply zoom and pan transformations
    this.ctx.setTransform(
      dpr * this.scale, 0, 0, 
      dpr * this.scale, 
      dpr * this.offsetX, 
      dpr * this.offsetY
    );
    
    this.elements.forEach(element => {
      this.drawElement(element);
    });
    
    // Draw selection box if an element is selected
    if (this.selectedElement) {
      this.drawSelectionBox(this.selectedElement);
    }
    
    // Draw remote cursors
    this.drawRemoteCursors();
  }
  
  drawRemoteCursors() {
    const now = Date.now();
    
    this.remoteCursors.forEach((cursor, oderId) => {
      // Skip cursors that haven't been updated in 5 seconds
      if (now - cursor.lastUpdate > 5000) {
        this.remoteCursors.delete(oderId);
        return;
      }
      
      this.drawCursor(cursor.x, cursor.y, cursor.color, cursor.userId);
    });
  }
  
  drawCursor(x, y, color, label) {
    this.ctx.save();
    
    // Draw cursor arrow
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5 / this.scale;
    
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x, y + 18 / this.scale);
    this.ctx.lineTo(x + 5 / this.scale, y + 14 / this.scale);
    this.ctx.lineTo(x + 10 / this.scale, y + 22 / this.scale);
    this.ctx.lineTo(x + 13 / this.scale, y + 20 / this.scale);
    this.ctx.lineTo(x + 8 / this.scale, y + 12 / this.scale);
    this.ctx.lineTo(x + 14 / this.scale, y + 12 / this.scale);
    this.ctx.closePath();
    
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw label background
    const fontSize = 11 / this.scale;
    this.ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    const labelWidth = this.ctx.measureText(label).width + 8 / this.scale;
    const labelHeight = 16 / this.scale;
    const labelX = x + 16 / this.scale;
    const labelY = y + 12 / this.scale;
    
    // Rounded rectangle background
    const radius = 4 / this.scale;
    this.ctx.beginPath();
    this.ctx.moveTo(labelX + radius, labelY);
    this.ctx.lineTo(labelX + labelWidth - radius, labelY);
    this.ctx.quadraticCurveTo(labelX + labelWidth, labelY, labelX + labelWidth, labelY + radius);
    this.ctx.lineTo(labelX + labelWidth, labelY + labelHeight - radius);
    this.ctx.quadraticCurveTo(labelX + labelWidth, labelY + labelHeight, labelX + labelWidth - radius, labelY + labelHeight);
    this.ctx.lineTo(labelX + radius, labelY + labelHeight);
    this.ctx.quadraticCurveTo(labelX, labelY + labelHeight, labelX, labelY + labelHeight - radius);
    this.ctx.lineTo(labelX, labelY + radius);
    this.ctx.quadraticCurveTo(labelX, labelY, labelX + radius, labelY);
    this.ctx.closePath();
    
    this.ctx.fillStyle = color;
    this.ctx.fill();
    
    // Draw label text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, labelX + 4 / this.scale, labelY + labelHeight / 2);
    
    this.ctx.restore();
  }

  drawElement(element) {
    this.ctx.strokeStyle = element.color;
    this.ctx.fillStyle = element.color;
    this.ctx.lineWidth = element.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    switch (element.type) {
      case 'pen':
        this.drawPen(element);
        break;
      case 'line':
        this.drawLine(element);
        break;
      case 'arrow':
        this.drawArrow(element);
        break;
      case 'rectangle':
        this.drawRectangle(element);
        break;
      case 'circle':
        this.drawCircle(element);
        break;
      case 'note':
        this.drawNote(element);
        break;
      case 'text':
        this.drawText(element);
        break;
    }
  }

  drawPen(element) {
    if (element.points.length < 2) return;
    
    this.ctx.beginPath();
    this.ctx.moveTo(element.points[0].x, element.points[0].y);
    
    for (let i = 1; i < element.points.length; i++) {
      this.ctx.lineTo(element.points[i].x, element.points[i].y);
    }
    
    this.ctx.stroke();
  }

  drawLine(element) {
    this.ctx.beginPath();
    this.ctx.moveTo(element.x1, element.y1);
    this.ctx.lineTo(element.x2, element.y2);
    this.ctx.stroke();
  }

  drawArrow(element) {
    this.ctx.beginPath();
    this.ctx.moveTo(element.x1, element.y1);
    this.ctx.lineTo(element.x2, element.y2);
    this.ctx.stroke();
    
    // Draw arrowheads based on style
    this.ctx.fillStyle = element.color;
    if (element.arrowStyle === 'double') {
      this.drawArrowhead(element.x1, element.y1, element.x2, element.y2, element.strokeWidth, true);
    }
    this.drawArrowhead(element.x1, element.y1, element.x2, element.y2, element.strokeWidth, false);
  }

  drawRectangle(element) {
    this.ctx.beginPath();
    this.ctx.strokeRect(element.x, element.y, element.width, element.height);
  }

  drawCircle(element) {
    this.ctx.beginPath();
    this.ctx.arc(element.cx, element.cy, element.radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  drawArrowhead(x1, y1, x2, y2, strokeWidth, atStart) {
    const headLength = Math.max(10, strokeWidth * 4);
    let angle, tipX, tipY;
    
    if (atStart) {
      angle = Math.atan2(y1 - y2, x1 - x2);
      tipX = x1;
      tipY = y1;
    } else {
      angle = Math.atan2(y2 - y1, x2 - x1);
      tipX = x2;
      tipY = y2;
    }
    
    const x3 = tipX - headLength * Math.cos(angle - Math.PI / 6);
    const y3 = tipY - headLength * Math.sin(angle - Math.PI / 6);
    const x4 = tipX - headLength * Math.cos(angle + Math.PI / 6);
    const y4 = tipY - headLength * Math.sin(angle + Math.PI / 6);
    
    this.ctx.beginPath();
    this.ctx.moveTo(tipX, tipY);
    this.ctx.lineTo(x3, y3);
    this.ctx.lineTo(x4, y4);
    this.ctx.closePath();
    this.ctx.fill();
  }

  drawNote(element) {
    const padding = 10;
    const lineHeight = 18;
    const maxWidth = element.width - padding * 2;
    
    // Draw note background
    this.ctx.fillStyle = element.backgroundColor || '#fff9c4';
    this.ctx.fillRect(element.x, element.y, element.width, element.height);
    
    // Draw note border
    this.ctx.strokeStyle = '#f0e68c';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(element.x, element.y, element.width, element.height);
    
    // Draw note text
    this.ctx.fillStyle = '#333';
    this.ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    
    const words = element.text.split(' ');
    let line = '';
    let y = element.y + padding + 14;
    
    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = this.ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && line !== '') {
        this.ctx.fillText(line, element.x + padding, y);
        line = word + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    this.ctx.fillText(line, element.x + padding, y);
  }

  drawText(element) {
    this.ctx.fillStyle = element.color;
    this.ctx.font = `${element.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(element.text, element.x, element.y);
  }

  drawPenPreview() {
    if (this.currentPath.length < 2) return;
    
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.beginPath();
    this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
    
    for (let i = 1; i < this.currentPath.length; i++) {
      this.ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
    }
    
    this.ctx.stroke();
  }

  drawShapePreview(point) {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    if (this.currentTool === 'line') {
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
    } else if (this.currentTool === 'arrow') {
      // Draw line
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);
      this.ctx.lineTo(point.x, point.y);
      this.ctx.stroke();
      
      // Draw arrowheads
      this.ctx.fillStyle = this.currentColor;
      if (this.arrowStyle === 'double') {
        this.drawArrowhead(this.startX, this.startY, point.x, point.y, this.strokeWidth, true);
      }
      this.drawArrowhead(this.startX, this.startY, point.x, point.y, this.strokeWidth, false);
    } else if (this.currentTool === 'rectangle') {
      this.ctx.beginPath();
      this.ctx.strokeRect(
        Math.min(this.startX, point.x),
        Math.min(this.startY, point.y),
        Math.abs(point.x - this.startX),
        Math.abs(point.y - this.startY)
      );
    } else if (this.currentTool === 'circle') {
      const radius = Math.sqrt(
        Math.pow(point.x - this.startX, 2) + 
        Math.pow(point.y - this.startY, 2)
      );
      this.ctx.beginPath();
      this.ctx.arc(this.startX, this.startY, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  // ============================================================
  // Selection and Dragging
  // ============================================================

  handleSelectStart(point) {
    // If element is already selected, check if clicking on a resize handle
    if (this.selectedElement) {
      const handle = this.getResizeHandleAtPoint(point);
      if (handle) {
        this.isResizing = true;
        this.resizeHandle = handle;
        this.resizeStartBounds = this.getElementBounds(this.selectedElement);
        this.dragOriginalState = JSON.parse(JSON.stringify(this.selectedElement));
        this.canvasContainer.classList.add('resizing');
        this.redraw();
        return;
      }
    }
    
    // Check if clicking on an element
    const element = this.getElementAtPoint(point);
    
    if (element) {
      this.selectedElement = element;
      this.isDragging = true;
      this.canvasContainer.classList.add('dragging');
      
      // Save original state for undo
      this.dragOriginalState = JSON.parse(JSON.stringify(element));
      
      // Calculate offset from element origin to click point
      const bounds = this.getElementBounds(element);
      this.dragOffsetX = point.x - bounds.x;
      this.dragOffsetY = point.y - bounds.y;
    } else {
      // Clicked on empty space - deselect
      this.selectedElement = null;
    }
    
    this.redraw();
  }
  
  getResizeHandleAtPoint(point) {
    if (!this.selectedElement) return null;
    
    const bounds = this.getElementBounds(this.selectedElement);
    const padding = 5;
    const handleSize = 16; // Larger hit area for easier clicking
    
    const handles = {
      nw: { x: bounds.x - padding, y: bounds.y - padding },
      ne: { x: bounds.x + bounds.width + padding, y: bounds.y - padding },
      sw: { x: bounds.x - padding, y: bounds.y + bounds.height + padding },
      se: { x: bounds.x + bounds.width + padding, y: bounds.y + bounds.height + padding }
    };
    
    for (const [name, pos] of Object.entries(handles)) {
      const dx = point.x - pos.x;
      const dy = point.y - pos.y;
      if (Math.abs(dx) <= handleSize && Math.abs(dy) <= handleSize) {
        return name;
      }
    }
    
    return null;
  }

  handleSelectDrag(point) {
    if (!this.selectedElement) return;
    
    // Handle resizing
    if (this.isResizing && this.resizeHandle) {
      this.resizeElement(this.selectedElement, point);
      this.redraw();
      return;
    }
    
    // Handle dragging
    if (!this.isDragging) return;
    
    const newX = point.x - this.dragOffsetX;
    const newY = point.y - this.dragOffsetY;
    
    this.moveElement(this.selectedElement, newX, newY);
    this.redraw();
  }
  
  resizeElement(element, point) {
    const bounds = this.resizeStartBounds;
    if (!bounds) return;
    
    let newX = bounds.x;
    let newY = bounds.y;
    let newWidth = bounds.width;
    let newHeight = bounds.height;
    
    // Calculate new dimensions based on resize handle
    switch (this.resizeHandle) {
      case 'se': // Bottom-right
        newWidth = Math.max(20, point.x - bounds.x);
        newHeight = Math.max(20, point.y - bounds.y);
        break;
      case 'sw': // Bottom-left
        newWidth = Math.max(20, bounds.x + bounds.width - point.x);
        newHeight = Math.max(20, point.y - bounds.y);
        newX = Math.min(point.x, bounds.x + bounds.width - 20);
        break;
      case 'ne': // Top-right
        newWidth = Math.max(20, point.x - bounds.x);
        newHeight = Math.max(20, bounds.y + bounds.height - point.y);
        newY = Math.min(point.y, bounds.y + bounds.height - 20);
        break;
      case 'nw': // Top-left
        newWidth = Math.max(20, bounds.x + bounds.width - point.x);
        newHeight = Math.max(20, bounds.y + bounds.height - point.y);
        newX = Math.min(point.x, bounds.x + bounds.width - 20);
        newY = Math.min(point.y, bounds.y + bounds.height - 20);
        break;
    }
    
    // Apply resize to element based on type
    this.applyResize(element, newX, newY, newWidth, newHeight);
  }
  
  applyResize(element, newX, newY, newWidth, newHeight) {
    const bounds = this.resizeStartBounds;
    if (!bounds) return;
    
    const scaleX = newWidth / bounds.width;
    const scaleY = newHeight / bounds.height;
    
    switch (element.type) {
      case 'rectangle':
      case 'note':
        element.x = newX;
        element.y = newY;
        element.width = newWidth;
        element.height = newHeight;
        break;
        
      case 'circle':
        // Keep aspect ratio for circles
        const scale = Math.max(scaleX, scaleY);
        const newRadius = (bounds.width / 2) * scale;
        element.radius = Math.max(10, newRadius);
        element.cx = newX + newWidth / 2;
        element.cy = newY + newHeight / 2;
        break;
        
      case 'line':
        // Scale line endpoints
        element.x1 = newX + (this.dragOriginalState.x1 - bounds.x) * scaleX;
        element.y1 = newY + (this.dragOriginalState.y1 - bounds.y) * scaleY;
        element.x2 = newX + (this.dragOriginalState.x2 - bounds.x) * scaleX;
        element.y2 = newY + (this.dragOriginalState.y2 - bounds.y) * scaleY;
        break;
        
      case 'arrow':
        element.x1 = newX + (this.dragOriginalState.x1 - bounds.x) * scaleX;
        element.y1 = newY + (this.dragOriginalState.y1 - bounds.y) * scaleY;
        element.x2 = newX + (this.dragOriginalState.x2 - bounds.x) * scaleX;
        element.y2 = newY + (this.dragOriginalState.y2 - bounds.y) * scaleY;
        break;
        
      case 'pen':
        // Scale all pen points
        element.points = this.dragOriginalState.points.map(p => ({
          x: newX + (p.x - bounds.x) * scaleX,
          y: newY + (p.y - bounds.y) * scaleY
        }));
        break;
        
      case 'text':
        // Scale font size
        element.x = newX;
        element.y = newY;
        element.fontSize = Math.max(8, Math.round(this.dragOriginalState.fontSize * Math.max(scaleX, scaleY)));
        break;
    }
  }

  handleSelectEnd(point) {
    // Handle end of resize
    if (this.isResizing && this.selectedElement && this.dragOriginalState) {
      const hasChanged = JSON.stringify(this.dragOriginalState) !== JSON.stringify(this.selectedElement);
      
      if (hasChanged) {
        // Save to history (using 'move' type for simplicity, it stores the full state)
        this.saveToHistory({
          type: 'move',
          elementId: this.selectedElement.id,
          previousState: this.dragOriginalState,
          newState: JSON.parse(JSON.stringify(this.selectedElement))
        });
        
        // Send update to other clients
        this.sendMessage({
          type: 'move',
          elementId: this.selectedElement.id,
          element: this.selectedElement
        });
      }
      
      this.isResizing = false;
      this.resizeHandle = null;
      this.resizeStartBounds = null;
      this.dragOriginalState = null;
      this.canvasContainer.classList.remove('resizing');
      return;
    }
    
    // Handle end of drag
    if (this.isDragging && this.selectedElement && this.dragOriginalState) {
      // Check if element actually moved
      const hasMoved = JSON.stringify(this.dragOriginalState) !== JSON.stringify(this.selectedElement);
      
      if (hasMoved) {
        // Save to history
        this.saveToHistory({
          type: 'move',
          elementId: this.selectedElement.id,
          previousState: this.dragOriginalState,
          newState: JSON.parse(JSON.stringify(this.selectedElement))
        });
        
        // Send move update to other clients
        this.sendMessage({
          type: 'move',
          elementId: this.selectedElement.id,
          element: this.selectedElement
        });
      }
    }
    
    this.isDragging = false;
    this.dragOriginalState = null;
    this.canvasContainer.classList.remove('dragging');
  }

  getElementAtPoint(point) {
    // Check elements in reverse order (top to bottom)
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const element = this.elements[i];
      if (this.isPointNearElement(point, element, 5)) {
        return element;
      }
    }
    return null;
  }

  getElementBounds(element) {
    switch (element.type) {
      case 'pen':
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of element.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      
      case 'line':
        return {
          x: Math.min(element.x1, element.x2),
          y: Math.min(element.y1, element.y2),
          width: Math.abs(element.x2 - element.x1),
          height: Math.abs(element.y2 - element.y1)
        };
      
      case 'arrow':
        return {
          x: Math.min(element.x1, element.x2),
          y: Math.min(element.y1, element.y2),
          width: Math.abs(element.x2 - element.x1),
          height: Math.abs(element.y2 - element.y1)
        };
      
      case 'rectangle':
      case 'note':
        return { x: element.x, y: element.y, width: element.width, height: element.height };
      
      case 'circle':
        return {
          x: element.cx - element.radius,
          y: element.cy - element.radius,
          width: element.radius * 2,
          height: element.radius * 2
        };
      
      case 'text':
        this.ctx.font = `${element.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        const textWidth = this.ctx.measureText(element.text).width;
        return { x: element.x, y: element.y, width: textWidth, height: element.fontSize * 1.2 };
      
      default:
        return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  moveElement(element, newX, newY) {
    const bounds = this.getElementBounds(element);
    const deltaX = newX - bounds.x;
    const deltaY = newY - bounds.y;
    
    switch (element.type) {
      case 'pen':
        for (const p of element.points) {
          p.x += deltaX;
          p.y += deltaY;
        }
        break;
      
      case 'line':
        element.x1 += deltaX;
        element.y1 += deltaY;
        element.x2 += deltaX;
        element.y2 += deltaY;
        break;
      
      case 'arrow':
        element.x1 += deltaX;
        element.y1 += deltaY;
        element.x2 += deltaX;
        element.y2 += deltaY;
        break;
      
      case 'rectangle':
      case 'note':
      case 'text':
        element.x = newX;
        element.y = newY;
        break;
      
      case 'circle':
        element.cx += deltaX;
        element.cy += deltaY;
        break;
    }
  }

  drawSelectionBox(element) {
    const bounds = this.getElementBounds(element);
    const padding = 5;
    
    this.ctx.save();
    this.ctx.strokeStyle = '#3498db';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeRect(
      bounds.x - padding,
      bounds.y - padding,
      bounds.width + padding * 2,
      bounds.height + padding * 2
    );
    
    // Draw corner handles
    this.ctx.fillStyle = '#3498db';
    this.ctx.setLineDash([]);
    const handleSize = 8;
    const corners = [
      { x: bounds.x - padding, y: bounds.y - padding },
      { x: bounds.x + bounds.width + padding, y: bounds.y - padding },
      { x: bounds.x - padding, y: bounds.y + bounds.height + padding },
      { x: bounds.x + bounds.width + padding, y: bounds.y + bounds.height + padding }
    ];
    
    for (const corner of corners) {
      this.ctx.fillRect(
        corner.x - handleSize / 2,
        corner.y - handleSize / 2,
        handleSize,
        handleSize
      );
    }
    
    this.ctx.restore();
  }

  // ============================================================
  // Zoom and Pan
  // ============================================================

  zoomIn() {
    const rect = this.canvasContainer.getBoundingClientRect();
    this.zoomAtPoint(rect.width / 2, rect.height / 2, 1.2);
  }

  zoomOut() {
    const rect = this.canvasContainer.getBoundingClientRect();
    this.zoomAtPoint(rect.width / 2, rect.height / 2, 0.8);
  }

  zoomAtPoint(screenX, screenY, factor) {
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    
    if (newScale === this.scale) return;
    
    // Calculate the canvas point at the mouse position before zoom
    const canvasX = (screenX - this.offsetX) / this.scale;
    const canvasY = (screenY - this.offsetY) / this.scale;
    
    // Apply new scale
    this.scale = newScale;
    
    // Adjust offset so the same canvas point stays under the mouse
    this.offsetX = screenX - canvasX * this.scale;
    this.offsetY = screenY - canvasY * this.scale;
    
    this.updateZoomDisplay();
    this.redraw();
  }

  resetZoom() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.updateZoomDisplay();
    this.redraw();
    this.showToast('Zoom reset');
  }

  updateZoomDisplay() {
    const zoomLevel = document.getElementById('zoomLevel');
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  // ============================================================
  // Undo/Redo
  // ============================================================

  saveToHistory(action) {
    // Save action to undo stack
    this.undoStack.push(action);
    
    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    this.redoStack = [];
    
    // Update button states
    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.undoStack.length === 0) {
      this.showToast('Nothing to undo');
      return;
    }
    
    const action = this.undoStack.pop();
    
    // Perform the reverse action
    switch (action.type) {
      case 'add':
        // Remove the added element
        this.elements = this.elements.filter(el => el.id !== action.element.id);
        this.sendMessage({ type: 'erase', elementId: action.element.id });
        break;
        
      case 'delete':
        // Re-add the deleted element at its original position
        if (action.index !== undefined) {
          this.elements.splice(action.index, 0, action.element);
        } else {
          this.elements.push(action.element);
        }
        this.sendMessage({ type: 'draw', element: action.element });
        break;
        
      case 'move':
        // Move element back to original position
        const moveEl = this.elements.find(el => el.id === action.elementId);
        if (moveEl) {
          Object.assign(moveEl, action.previousState);
          this.sendMessage({ type: 'move', elementId: action.elementId, element: moveEl });
        }
        break;
        
      case 'reorder':
        // Move element back to original index
        const reorderIdx = this.elements.findIndex(el => el.id === action.elementId);
        if (reorderIdx !== -1) {
          const [element] = this.elements.splice(reorderIdx, 1);
          this.elements.splice(action.previousIndex, 0, element);
          // For sync, we just send the full reorder back
          this.sendMessage({ 
            type: 'reorder', 
            elementId: action.elementId, 
            position: action.previousIndex === 0 ? 'back' : 'front'
          });
        }
        break;
        
      case 'clear':
        // Restore all cleared elements
        this.elements = [...action.elements];
        action.elements.forEach(el => {
          this.sendMessage({ type: 'draw', element: el });
        });
        break;
    }
    
    // Push to redo stack
    this.redoStack.push(action);
    
    // Clear selection
    this.selectedElement = null;
    
    this.updateUndoRedoButtons();
    this.redraw();
    this.showToast('Undo');
  }

  redo() {
    if (this.redoStack.length === 0) {
      this.showToast('Nothing to redo');
      return;
    }
    
    const action = this.redoStack.pop();
    
    // Perform the action again
    switch (action.type) {
      case 'add':
        // Re-add the element
        this.elements.push(action.element);
        this.sendMessage({ type: 'draw', element: action.element });
        break;
        
      case 'delete':
        // Delete the element again
        this.elements = this.elements.filter(el => el.id !== action.element.id);
        this.sendMessage({ type: 'erase', elementId: action.element.id });
        break;
        
      case 'move':
        // Apply the new position
        const moveEl = this.elements.find(el => el.id === action.elementId);
        if (moveEl) {
          Object.assign(moveEl, action.newState);
          this.sendMessage({ type: 'move', elementId: action.elementId, element: moveEl });
        }
        break;
        
      case 'reorder':
        // Apply the new index
        const reorderIdx = this.elements.findIndex(el => el.id === action.elementId);
        if (reorderIdx !== -1) {
          const [element] = this.elements.splice(reorderIdx, 1);
          if (action.newIndex === this.elements.length || action.position === 'front') {
            this.elements.push(element);
          } else {
            this.elements.unshift(element);
          }
          this.sendMessage({ type: 'reorder', elementId: action.elementId, position: action.position });
        }
        break;
        
      case 'clear':
        // Clear again
        this.elements = [];
        this.sendMessage({ type: 'clear' });
        break;
    }
    
    // Push back to undo stack
    this.undoStack.push(action);
    
    // Clear selection
    this.selectedElement = null;
    
    this.updateUndoRedoButtons();
    this.redraw();
    this.showToast('Redo');
  }

  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
      undoBtn.disabled = this.undoStack.length === 0;
      undoBtn.classList.toggle('disabled', this.undoStack.length === 0);
    }
    
    if (redoBtn) {
      redoBtn.disabled = this.redoStack.length === 0;
      redoBtn.classList.toggle('disabled', this.redoStack.length === 0);
    }
  }

  // ============================================================
  // Layer Ordering (Z-Index)
  // ============================================================

  moveToFront() {
    if (!this.selectedElement) {
      this.showToast('Select an element first');
      return;
    }
    
    const index = this.elements.findIndex(el => el.id === this.selectedElement.id);
    if (index === -1 || index === this.elements.length - 1) {
      // Already at front or not found
      return;
    }
    
    // Save to history
    this.saveToHistory({
      type: 'reorder',
      elementId: this.selectedElement.id,
      previousIndex: index,
      newIndex: this.elements.length - 1,
      position: 'front'
    });
    
    // Remove from current position and add to end (front)
    const [element] = this.elements.splice(index, 1);
    this.elements.push(element);
    
    // Sync with other clients
    this.sendMessage({
      type: 'reorder',
      elementId: element.id,
      position: 'front'
    });
    
    this.redraw();
    this.showToast('Moved to front');
  }

  moveToBack() {
    if (!this.selectedElement) {
      this.showToast('Select an element first');
      return;
    }
    
    const index = this.elements.findIndex(el => el.id === this.selectedElement.id);
    if (index === -1 || index === 0) {
      // Already at back or not found
      return;
    }
    
    // Save to history
    this.saveToHistory({
      type: 'reorder',
      elementId: this.selectedElement.id,
      previousIndex: index,
      newIndex: 0,
      position: 'back'
    });
    
    // Remove from current position and add to beginning (back)
    const [element] = this.elements.splice(index, 1);
    this.elements.unshift(element);
    
    // Sync with other clients
    this.sendMessage({
      type: 'reorder',
      elementId: element.id,
      position: 'back'
    });
    
    this.redraw();
    this.showToast('Moved to back');
  }

  // ============================================================
  // Eraser
  // ============================================================

  eraseAt(point) {
    const hitRadius = 10;
    
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const element = this.elements[i];
      
      if (this.isPointNearElement(point, element, hitRadius)) {
        const elementId = element.id;
        const deletedElement = this.elements.splice(i, 1)[0];
        this.sendMessage({ type: 'erase', elementId });
        this.saveToHistory({ type: 'delete', element: deletedElement, index: i });
        this.redraw();
        break;
      }
    }
  }

  isPointNearElement(point, element, radius) {
    switch (element.type) {
      case 'pen':
        return this.isPointNearPath(point, element.points, radius);
      case 'line':
        return this.isPointNearLine(
          point, 
          { x: element.x1, y: element.y1 }, 
          { x: element.x2, y: element.y2 }, 
          radius
        );
      case 'arrow':
        return this.isPointNearLine(
          point,
          { x: element.x1, y: element.y1 },
          { x: element.x2, y: element.y2 },
          radius
        );
      case 'rectangle':
        return this.isPointNearRectangle(point, element, radius);
      case 'circle':
        return this.isPointNearCircle(point, element, radius);
      case 'note':
        return point.x >= element.x && 
               point.x <= element.x + element.width &&
               point.y >= element.y && 
               point.y <= element.y + element.height;
      case 'text':
        // Measure text width for hit detection with padding
        this.ctx.font = `${element.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        const textWidth = this.ctx.measureText(element.text).width;
        const textHeight = element.fontSize * 1.2; // Account for line height
        const padding = 5;
        return point.x >= element.x - padding && 
               point.x <= element.x + textWidth + padding &&
               point.y >= element.y - padding && 
               point.y <= element.y + textHeight + padding;
      default:
        return false;
    }
  }

  isPointNearPath(point, path, radius) {
    for (let i = 1; i < path.length; i++) {
      if (this.isPointNearLine(point, path[i-1], path[i], radius)) {
        return true;
      }
    }
    return false;
  }

  isPointNearLine(point, start, end, radius) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) {
      return Math.sqrt(Math.pow(point.x - start.x, 2) + Math.pow(point.y - start.y, 2)) <= radius;
    }
    
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length)));
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    
    return Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.y - projY, 2)) <= radius;
  }

  isPointNearRectangle(point, rect, radius) {
    // Check all four edges
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height }
    ];
    
    for (let i = 0; i < 4; i++) {
      if (this.isPointNearLine(point, corners[i], corners[(i + 1) % 4], radius)) {
        return true;
      }
    }
    return false;
  }

  isPointNearCircle(point, circle, radius) {
    const dist = Math.sqrt(
      Math.pow(point.x - circle.cx, 2) + 
      Math.pow(point.y - circle.cy, 2)
    );
    return Math.abs(dist - circle.radius) <= radius;
  }

  // ============================================================
  // Notes
  // ============================================================

  saveNote() {
    const text = document.getElementById('noteText').value.trim();
    if (!text || !this.pendingNotePosition) return;
    
    const element = {
      id: this.generateId(),
      type: 'note',
      x: this.pendingNotePosition.x,
      y: this.pendingNotePosition.y,
      width: 200,
      height: 100,
      text: text,
      backgroundColor: '#fff9c4',
      color: '#333',
      strokeWidth: 1
    };
    
    this.elements.push(element);
    this.sendMessage({ type: 'draw', element });
    this.saveToHistory({ type: 'add', element });
    this.redraw();
    
    document.getElementById('noteModal').classList.remove('active');
    this.pendingNotePosition = null;
  }

  // ============================================================
  // Text
  // ============================================================

  saveText() {
    const text = document.getElementById('textInput').value.trim();
    if (!text || !this.pendingTextPosition) return;
    
    const fontSize = parseInt(document.getElementById('fontSizeSelect').value);
    
    const element = {
      id: this.generateId(),
      type: 'text',
      x: this.pendingTextPosition.x,
      y: this.pendingTextPosition.y,
      text: text,
      fontSize: fontSize,
      color: this.currentColor,
      strokeWidth: 1
    };
    
    this.elements.push(element);
    this.sendMessage({ type: 'draw', element });
    this.saveToHistory({ type: 'add', element });
    this.redraw();
    
    document.getElementById('textModal').classList.remove('active');
    this.pendingTextPosition = null;
  }

  // ============================================================
  // Clear All
  // ============================================================

  clearAll() {
    // Save all elements for undo
    if (this.elements.length > 0) {
      this.saveToHistory({ type: 'clear', elements: [...this.elements] });
    }
    this.elements = [];
    this.selectedElement = null;
    this.sendMessage({ type: 'clear' });
    this.redraw();
    this.showToast('Whiteboard cleared');
  }

  // ============================================================
  // Export
  // ============================================================

  getCanvasBounds() {
    if (this.elements.length === 0) {
      return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    }
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const element of this.elements) {
      const bounds = this.getElementBounds(element);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }
    
    // Add padding
    const padding = 20;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    };
  }

  exportAsPng() {
    if (this.elements.length === 0) {
      this.showToast('Nothing to export');
      return;
    }
    
    const bounds = this.getCanvasBounds();
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    // Create a temporary canvas
    const tempCanvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    tempCanvas.width = width * dpr;
    tempCanvas.height = height * dpr;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Set white background
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Apply DPR scaling and translate to center content
    tempCtx.scale(dpr, dpr);
    tempCtx.translate(-bounds.minX, -bounds.minY);
    
    // Draw all elements
    for (const element of this.elements) {
      this.drawElementToContext(tempCtx, element);
    }
    
    // Create download link
    const link = document.createElement('a');
    link.download = `whiteboard-${this.sessionId}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
    
    this.showToast('Exported as PNG');
  }

  exportAsSvg() {
    if (this.elements.length === 0) {
      this.showToast('Nothing to export');
      return;
    }
    
    const bounds = this.getCanvasBounds();
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    // Start building SVG
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${bounds.minX} ${bounds.minY} ${width} ${height}">
  <rect x="${bounds.minX}" y="${bounds.minY}" width="${width}" height="${height}" fill="white"/>
`;
    
    // Convert each element to SVG
    for (const element of this.elements) {
      svg += this.elementToSvg(element);
    }
    
    svg += '</svg>';
    
    // Create download link
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `whiteboard-${this.sessionId}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    
    this.showToast('Exported as SVG');
  }

  drawElementToContext(ctx, element) {
    ctx.strokeStyle = element.color;
    ctx.fillStyle = element.color;
    ctx.lineWidth = element.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    switch (element.type) {
      case 'pen':
        if (element.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) {
          ctx.lineTo(element.points[i].x, element.points[i].y);
        }
        ctx.stroke();
        break;
        
      case 'line':
        ctx.beginPath();
        ctx.moveTo(element.x1, element.y1);
        ctx.lineTo(element.x2, element.y2);
        ctx.stroke();
        break;
        
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(element.x1, element.y1);
        ctx.lineTo(element.x2, element.y2);
        ctx.stroke();
        
        // Draw arrowheads
        ctx.fillStyle = element.color;
        if (element.arrowStyle === 'double') {
          this.drawArrowheadToContext(ctx, element.x1, element.y1, element.x2, element.y2, element.strokeWidth, true);
        }
        this.drawArrowheadToContext(ctx, element.x1, element.y1, element.x2, element.y2, element.strokeWidth, false);
        break;
        
      case 'rectangle':
        ctx.beginPath();
        ctx.strokeRect(element.x, element.y, element.width, element.height);
        break;
        
      case 'circle':
        ctx.beginPath();
        ctx.arc(element.cx, element.cy, element.radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
        
      case 'note':
        // Draw note background
        ctx.fillStyle = element.backgroundColor || '#fff9c4';
        ctx.fillRect(element.x, element.y, element.width, element.height);
        ctx.strokeStyle = '#f0e68c';
        ctx.lineWidth = 1;
        ctx.strokeRect(element.x, element.y, element.width, element.height);
        
        // Draw note text
        ctx.fillStyle = '#333';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        const padding = 10;
        const lineHeight = 18;
        const maxWidth = element.width - padding * 2;
        const words = element.text.split(' ');
        let line = '';
        let y = element.y + padding + 14;
        
        for (const word of words) {
          const testLine = line + word + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line, element.x + padding, y);
            line = word + ' ';
            y += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, element.x + padding, y);
        break;
        
      case 'text':
        ctx.fillStyle = element.color;
        ctx.font = `${element.fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(element.text, element.x, element.y);
        break;
    }
  }

  drawArrowheadToContext(ctx, x1, y1, x2, y2, strokeWidth, atStart) {
    const headLength = Math.max(10, strokeWidth * 4);
    let angle, tipX, tipY;
    
    if (atStart) {
      angle = Math.atan2(y1 - y2, x1 - x2);
      tipX = x1;
      tipY = y1;
    } else {
      angle = Math.atan2(y2 - y1, x2 - x1);
      tipX = x2;
      tipY = y2;
    }
    
    const x3 = tipX - headLength * Math.cos(angle - Math.PI / 6);
    const y3 = tipY - headLength * Math.sin(angle - Math.PI / 6);
    const x4 = tipX - headLength * Math.cos(angle + Math.PI / 6);
    const y4 = tipY - headLength * Math.sin(angle + Math.PI / 6);
    
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  elementToSvg(element) {
    const escape = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    
    switch (element.type) {
      case 'pen':
        if (element.points.length < 2) return '';
        const pathData = element.points.map((p, i) => 
          (i === 0 ? 'M' : 'L') + `${p.x},${p.y}`
        ).join(' ');
        return `  <path d="${pathData}" stroke="${element.color}" stroke-width="${element.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>\n`;
        
      case 'line':
        return `  <line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="${element.color}" stroke-width="${element.strokeWidth}" stroke-linecap="round"/>\n`;
        
      case 'arrow':
        const arrowAngle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
        const arrowHeadLength = Math.max(10, element.strokeWidth * 4);
        
        // Calculate end arrowhead points
        const endX3 = element.x2 - arrowHeadLength * Math.cos(arrowAngle - Math.PI / 6);
        const endY3 = element.y2 - arrowHeadLength * Math.sin(arrowAngle - Math.PI / 6);
        const endX4 = element.x2 - arrowHeadLength * Math.cos(arrowAngle + Math.PI / 6);
        const endY4 = element.y2 - arrowHeadLength * Math.sin(arrowAngle + Math.PI / 6);
        
        let arrowSvg = `  <g>
    <line x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}" stroke="${element.color}" stroke-width="${element.strokeWidth}" stroke-linecap="round"/>
    <polygon points="${element.x2},${element.y2} ${endX3},${endY3} ${endX4},${endY4}" fill="${element.color}"/>`;
        
        if (element.arrowStyle === 'double') {
          const startAngle = Math.atan2(element.y1 - element.y2, element.x1 - element.x2);
          const startX3 = element.x1 - arrowHeadLength * Math.cos(startAngle - Math.PI / 6);
          const startY3 = element.y1 - arrowHeadLength * Math.sin(startAngle - Math.PI / 6);
          const startX4 = element.x1 - arrowHeadLength * Math.cos(startAngle + Math.PI / 6);
          const startY4 = element.y1 - arrowHeadLength * Math.sin(startAngle + Math.PI / 6);
          arrowSvg += `
    <polygon points="${element.x1},${element.y1} ${startX3},${startY3} ${startX4},${startY4}" fill="${element.color}"/>`;
        }
        
        arrowSvg += `
  </g>\n`;
        return arrowSvg;
        
      case 'rectangle':
        return `  <rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" stroke="${element.color}" stroke-width="${element.strokeWidth}" fill="none"/>\n`;
        
      case 'circle':
        return `  <circle cx="${element.cx}" cy="${element.cy}" r="${element.radius}" stroke="${element.color}" stroke-width="${element.strokeWidth}" fill="none"/>\n`;
        
      case 'note':
        const bg = element.backgroundColor || '#fff9c4';
        return `  <g>
    <rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="${bg}" stroke="#f0e68c" stroke-width="1"/>
    <text x="${element.x + 10}" y="${element.y + 24}" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" fill="#333">${escape(element.text)}</text>
  </g>\n`;
        
      case 'text':
        return `  <text x="${element.x}" y="${element.y}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="${element.fontSize}" fill="${element.color}" dominant-baseline="hanging">${escape(element.text)}</text>\n`;
        
      default:
        return '';
    }
  }

  // ============================================================
  // WebSocket
  // ============================================================

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}?session=${this.sessionId}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('Connected to whiteboard session');
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleServerMessage(message);
    };
    
    this.ws.onclose = () => {
      console.log('Disconnected from server');
      // Attempt to reconnect after a delay
      setTimeout(() => this.connectWebSocket(), 3000);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleServerMessage(message) {
    switch (message.type) {
      case 'init':
        this.userId = message.userId;
        this.elements = message.elements || [];
        this.updateUserCount(message.userCount);
        this.redraw();
        break;
        
      case 'draw':
        this.elements.push(message.element);
        this.redraw();
        break;
        
      case 'erase':
        this.elements = this.elements.filter(el => el.id !== message.elementId);
        this.redraw();
        break;
        
      case 'clear':
        this.elements = [];
        this.redraw();
        break;
      
      case 'move':
        // Update the moved element
        const moveIndex = this.elements.findIndex(el => el.id === message.elementId);
        if (moveIndex !== -1) {
          this.elements[moveIndex] = message.element;
          this.redraw();
        }
        break;
      
      case 'reorder':
        // Reorder element (move to front/back)
        const reorderIndex = this.elements.findIndex(el => el.id === message.elementId);
        if (reorderIndex !== -1) {
          const [element] = this.elements.splice(reorderIndex, 1);
          if (message.position === 'front') {
            this.elements.push(element);
          } else if (message.position === 'back') {
            this.elements.unshift(element);
          }
          this.redraw();
        }
        break;
        
      case 'userCount':
        this.updateUserCount(message.count);
        break;
        
      case 'cursor':
        // Update remote cursor position
        if (message.oderId !== this.userId) {
          const colorIndex = this.hashCode(message.oderId) % this.cursorColors.length;
          this.remoteCursors.set(message.oderId, {
            oderId: message.oderId,
            userId: message.oderId.substring(0, 4), // Short display name
            x: message.x,
            y: message.y,
            color: this.cursorColors[colorIndex],
            lastUpdate: Date.now()
          });
          this.redraw();
        }
        break;
        
      case 'userLeft':
        // Remove cursor when user leaves
        this.remoteCursors.delete(message.oderId);
        this.redraw();
        break;
    }
  }
  
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // ============================================================
  // UI Updates
  // ============================================================

  updateSessionDisplay() {
    document.getElementById('sessionId').textContent = `Session: ${this.sessionId}`;
  }

  updateUserCount(count) {
    document.getElementById('userCount').textContent = `Users: ${count}`;
  }

  shareLink() {
    const url = window.location.href;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.showToast('Link copied to clipboard!');
      }).catch(() => {
        this.showToast('Failed to copy link');
      });
    } else {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      this.showToast('Link copied to clipboard!');
    }
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('active');
    
    setTimeout(() => {
      toast.classList.remove('active');
    }, 3000);
  }

  // ============================================================
  // Utilities
  // ============================================================

  generateId() {
    return Math.random().toString(36).substring(2, 11);
  }
}

// Initialize the whiteboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
  window.whiteboard = new Whiteboard();
});
