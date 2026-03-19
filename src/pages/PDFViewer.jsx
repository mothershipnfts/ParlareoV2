import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Download, Pen, Type, Square, Circle, Eraser, Trash2, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PDFViewer() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const lessonId = params.get("lessonId");

  const canvasRef = useRef(null);
  const currentPathRef = useRef([]);
  const [lesson, setLesson] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#f97066");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [rectStart, setRectStart] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadData(); }, [lessonId]);

  const loadData = async () => {
    const me = await base44.auth.me();
    const [lessons, acc] = await Promise.all([
      base44.entities.PDFLesson.filter({ id: lessonId }),
      base44.entities.StudentPDFAccess.filter({ student_email: me.email, pdf_lesson_id: lessonId })
    ]);
    if (lessons.length === 0 || acc.length === 0) { navigate(createPageUrl("PDFLessonStore")); return; }
    setLesson(lessons[0]);
    setAccess(acc[0]);
    if (acc[0].annotations) { try { setAnnotations(JSON.parse(acc[0].annotations)); } catch (e) {} }
    setLoading(false);
  };

  useEffect(() => { if (!loading && canvasRef.current) redrawCanvas(); }, [loading, annotations]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    annotations.forEach(ann => drawAnnotation(ctx, ann));
  };

  const drawAnnotation = (ctx, ann) => {
    ctx.save();
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.strokeWidth || 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (ann.type === "path" && ann.points?.length > 1) {
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x, ann.points[0].y);
      ann.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (ann.type === "erase" && ann.points?.length > 1) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(ann.points[0].x, ann.points[0].y);
      ann.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (ann.type === "rect") {
      ctx.strokeRect(ann.x, ann.y, ann.w, ann.h);
    } else if (ann.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(ann.cx, ann.cy, ann.rx, ann.ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (ann.type === "text") {
      ctx.font = `${ann.fontSize || 16}px sans-serif`;
      ctx.fillText(ann.text, ann.x, ann.y);
    }
    ctx.restore();
  };

  const startDraw = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    setIsDrawing(true);
    setLastPos(pos);
    currentPathRef.current = [pos];
    if (tool === "text") setTextPos(pos);
    if (tool === "rect" || tool === "circle") {
      if (!rectStart) { setRectStart(pos); return; }
      const newAnn = tool === "rect"
        ? { id: Date.now(), type: "rect", color, strokeWidth, x: rectStart.x, y: rectStart.y, w: pos.x - rectStart.x, h: pos.y - rectStart.y }
        : { id: Date.now(), type: "circle", color, strokeWidth, cx: (rectStart.x + pos.x) / 2, cy: (rectStart.y + pos.y) / 2, rx: Math.abs(pos.x - rectStart.x) / 2, ry: Math.abs(pos.y - rectStart.y) / 2 };
      setAnnotations(prev => [...prev, newAnn]);
      setRectStart(null);
    }
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing || tool === "text" || tool === "rect" || tool === "circle") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e);
    currentPathRef.current.push(pos);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (tool === "eraser") { ctx.globalCompositeOperation = "destination-out"; ctx.lineWidth = 20; ctx.strokeStyle = "rgba(0,0,0,1)"; }
    else { ctx.strokeStyle = color; ctx.lineWidth = strokeWidth; }
    if (lastPos) { ctx.beginPath(); ctx.moveTo(lastPos.x, lastPos.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
    ctx.restore();
    setLastPos(pos);
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const points = currentPathRef.current;
    if (points.length > 1 && tool !== "text" && tool !== "rect" && tool !== "circle") {
      setAnnotations(prev => [...prev, { id: Date.now(), type: tool === "eraser" ? "erase" : "path", color, strokeWidth, points: [...points] }]);
    }
    currentPathRef.current = [];
  };

  const addText = () => {
    if (!textPos || !textInput.trim()) { setTextPos(null); setTextInput(""); return; }
    setAnnotations(prev => [...prev, { id: Date.now(), type: "text", color, text: textInput, x: textPos.x, y: textPos.y, fontSize: 16 }]);
    setTextPos(null);
    setTextInput("");
  };

  const undo = () => setAnnotations(prev => prev.slice(0, -1));
  const clearAll = () => { setAnnotations([]); const canvas = canvasRef.current; if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); };

  const saveAnnotations = async () => {
    setSaving(true);
    await base44.entities.StudentPDFAccess.update(access.id, { annotations: JSON.stringify(annotations) });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const TOOLS = [
    { id: "pen", icon: Pen, label: "Pen" },
    { id: "text", icon: Type, label: "Text" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "circle", icon: Circle, label: "Circle" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
  ];

  const COLORS = ["#f97066", "#1a1b4b", "#10b981", "#6366f1", "#f59e0b", "#ec4899", "#000000", "#ffffff"];

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" /></div>;

  return (
    <div className="flex flex-col bg-gray-100 -m-4 md:-m-8" style={{ height: "100vh" }}>
      {/* Toolbar */}
      <div className="bg-[#1a1b4b] text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate(createPageUrl("PDFLessonStore"))} className="text-white/60 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{lesson?.title}</p>
          <p className="text-xs text-white/40 capitalize">{lesson?.level?.replace(/_/g, ' ')}</p>
        </div>
        <Button size="sm" onClick={() => window.open(lesson?.pdf_url, '_blank')} className="bg-white/10 hover:bg-white/20 border-0 rounded-lg text-xs gap-1">
          <Download className="w-3.5 h-3.5" /> Download
        </Button>
        <Button size="sm" onClick={saveAnnotations} disabled={saving} className="bg-[#f97066] hover:bg-[#e8605a] rounded-lg text-xs gap-1">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? 'Saved!' : 'Save'}
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Side tools */}
        <div className="bg-white border-r border-gray-200 p-3 flex flex-col gap-3 flex-shrink-0 overflow-y-auto" style={{ width: 64 }}>
          <div className="flex flex-col gap-1">
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${tool === t.id ? 'bg-[#f97066] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                <t.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex flex-col gap-1.5 items-center">
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-[#1a1b4b] scale-125' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex flex-col gap-1 items-center">
            {[1, 3, 6, 10].map(w => (
              <button key={w} onClick={() => setStrokeWidth(w)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${strokeWidth === w ? 'bg-[#1a1b4b]/10' : 'hover:bg-gray-100'}`}>
                <div className="bg-gray-700 rounded-full" style={{ width: w * 2.5, height: w * 2.5 }} />
              </button>
            ))}
          </div>
          <div className="h-px bg-gray-100" />
          <button onClick={undo} title="Undo" className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100"><RotateCcw className="w-4 h-4" /></button>
          <button onClick={clearAll} title="Clear" className="w-10 h-10 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
        </div>

        {/* PDF + Canvas */}
        <div className="flex-1 overflow-auto relative">
          <div className="relative" style={{ minHeight: "100vh" }}>
            <iframe src={`${lesson?.pdf_url}#toolbar=0`} className="w-full border-0" style={{ height: "calc(100vh - 60px)" }} title="PDF Lesson" />
            <canvas
              ref={canvasRef}
              width={1200}
              height={1600}
              className="absolute top-0 left-0 w-full"
              style={{ height: "calc(100vh - 60px)", cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : "crosshair", touchAction: "none" }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          {textPos && (
            <div className="absolute z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 flex gap-2" style={{ left: textPos.x / 1.5, top: textPos.y / 2 }}>
              <input autoFocus value={textInput} onChange={e => setTextInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addText()}
                placeholder="Type text..." className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none w-48" />
              <Button size="sm" onClick={addText} className="bg-[#f97066] hover:bg-[#e8605a] rounded-lg">Add</Button>
              <Button size="sm" variant="ghost" onClick={() => { setTextPos(null); setTextInput(""); }} className="rounded-lg">✕</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}