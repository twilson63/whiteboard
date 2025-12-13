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
    this.connectWebSocket();
    this.updateSessionDisplay();
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
    
    this.ctx.scale(dpr, dpr);
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
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  handleMouseDown(e) {
    const point = this.getCanvasPoint(e);
    this.startDrawing(point);
  }

  handleMouseMove(e) {
    const point = this.getCanvasPoint(e);
    this.continueDrawing(point);
  }

  handleMouseUp(e) {
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
    // Handle dragging for select tool
    if (this.currentTool === 'select' && this.isDragging) {
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
    } else if (['line', 'rectangle', 'circle'].includes(this.currentTool)) {
      this.redraw();
      this.drawShapePreview(point);
    }
  }

  endDrawing(point) {
    // Handle end of dragging for select tool
    if (this.currentTool === 'select' && this.isDragging) {
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
      this.redraw();
    }
    
    this.currentPath = [];
  }

  // ============================================================
  // Drawing Rendering
  // ============================================================

  redraw() {
    const rect = this.canvasContainer.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    
    this.elements.forEach(element => {
      this.drawElement(element);
    });
    
    // Draw selection box if an element is selected
    if (this.selectedElement) {
      this.drawSelectionBox(this.selectedElement);
    }
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

  drawRectangle(element) {
    this.ctx.beginPath();
    this.ctx.strokeRect(element.x, element.y, element.width, element.height);
  }

  drawCircle(element) {
    this.ctx.beginPath();
    this.ctx.arc(element.cx, element.cy, element.radius, 0, Math.PI * 2);
    this.ctx.stroke();
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
    // Check if clicking on an element
    const element = this.getElementAtPoint(point);
    
    if (element) {
      this.selectedElement = element;
      this.isDragging = true;
      this.canvasContainer.classList.add('dragging');
      
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

  handleSelectDrag(point) {
    if (!this.selectedElement || !this.isDragging) return;
    
    const newX = point.x - this.dragOffsetX;
    const newY = point.y - this.dragOffsetY;
    
    this.moveElement(this.selectedElement, newX, newY);
    this.redraw();
  }

  handleSelectEnd(point) {
    if (this.isDragging && this.selectedElement) {
      // Send move update to other clients
      this.sendMessage({
        type: 'move',
        elementId: this.selectedElement.id,
        element: this.selectedElement
      });
    }
    
    this.isDragging = false;
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
  // Eraser
  // ============================================================

  eraseAt(point) {
    const hitRadius = 10;
    
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const element = this.elements[i];
      
      if (this.isPointNearElement(point, element, hitRadius)) {
        const elementId = element.id;
        this.elements.splice(i, 1);
        this.sendMessage({ type: 'erase', elementId });
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
    this.redraw();
    
    document.getElementById('textModal').classList.remove('active');
    this.pendingTextPosition = null;
  }

  // ============================================================
  // Clear All
  // ============================================================

  clearAll() {
    this.elements = [];
    this.sendMessage({ type: 'clear' });
    this.redraw();
    this.showToast('Whiteboard cleared');
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
        const index = this.elements.findIndex(el => el.id === message.elementId);
        if (index !== -1) {
          this.elements[index] = message.element;
          this.redraw();
        }
        break;
        
      case 'userCount':
        this.updateUserCount(message.count);
        break;
    }
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
