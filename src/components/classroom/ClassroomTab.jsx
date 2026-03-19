import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Sparkles, Loader2,
  MessageSquare, Settings, Users, BookOpen, CheckCircle,
  AlertCircle, ArrowRight, Monitor, Volume2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Pre-join Lobby ────────────────────────────────────────────────────────────
function Lobby({ booking, user, onJoin }) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [stream, setStream] = useState(null);
  const [camError, setCamError] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    startPreview();
    return () => stopPreview();
  }, []);

  const startPreview = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setCamError(true);
    }
  };

  const stopPreview = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
  };

  const toggleCam = () => {
    if (stream) {
      stream.getVideoTracks().forEach(t => { t.enabled = !camOn; });
    }
    setCamOn(v => !v);
  };

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(t => { t.enabled = !micOn; });
    }
    setMicOn(v => !v);
  };

  const handleJoin = () => {
    stopPreview();
    onJoin({ micOn, camOn });
  };

  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1b4b]">Classroom</h1>
        <p className="text-gray-400 text-sm mt-1">Check your audio and video before joining</p>
      </div>

      {booking && (
        <div className="bg-[#1a1b4b] text-white rounded-2xl px-6 py-4 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-white/80" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-base">
              {isTeacher ? `Lesson with ${booking.student_name}` : `Lesson with your teacher`}
            </p>
            <p className="text-white/60 text-sm">
              {booking.date} · {booking.start_time?.slice(0,5)} – {booking.end_time?.slice(0,5)} · {booking.session_duration} min
            </p>
          </div>
          <Badge className="bg-white/20 text-white border-0 capitalize">
            {booking.student_level?.replace(/_/g, " ")}
          </Badge>
        </div>
      )}

      {!booking && (
        <div className="bg-gradient-to-r from-violet-500 to-[#1a1b4b] text-white rounded-2xl px-6 py-4 mb-6">
          <p className="font-bold">Demo Classroom</p>
          <p className="text-white/60 text-sm">No lesson scheduled right now — testing your setup</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera preview */}
        <div>
          <div className="relative bg-[#1a1b4b] rounded-2xl overflow-hidden aspect-video">
            {!camError ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover transition-opacity ${camOn ? "opacity-100" : "opacity-0"}`}
                />
                {!camOn && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {user?.full_name?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-8 h-8 text-amber-400" />
                <p className="text-white/60 text-sm text-center px-4">Camera not available</p>
              </div>
            )}

            {/* mic indicator */}
            <div className={`absolute bottom-3 left-3 px-2 py-1 rounded-full text-xs flex items-center gap-1 ${micOn ? "bg-emerald-500/80 text-white" : "bg-red-500/80 text-white"}`}>
              {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              {micOn ? "Mic on" : "Muted"}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={toggleMic}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border-2 ${
                micOn
                  ? "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  : "bg-red-500 border-red-500 text-white"
              }`}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleCam}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border-2 ${
                camOn
                  ? "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                  : "bg-red-500 border-red-500 text-white"
              }`}
            >
              {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Setup checklist + join */}
        <div className="flex flex-col gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#1a1b4b]">Setup Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Camera", ok: !camError && camOn, warn: !camOn, msg: camError ? "Not detected" : camOn ? "Ready" : "Disabled" },
                { label: "Microphone", ok: micOn, warn: !micOn, msg: micOn ? "Ready" : "Muted" },
                { label: "Internet", ok: true, msg: "Connected" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    item.ok ? "bg-emerald-100" : item.warn ? "bg-amber-100" : "bg-red-100"
                  }`}>
                    {item.ok
                      ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                      : <AlertCircle className={`w-4 h-4 ${item.warn ? "text-amber-600" : "text-red-500"}`} />
                    }
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">{item.label}</p>
                  </div>
                  <span className={`text-xs font-semibold ${
                    item.ok ? "text-emerald-600" : item.warn ? "text-amber-600" : "text-red-500"
                  }`}>{item.msg}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button
            onClick={handleJoin}
            className="w-full bg-[#f97066] hover:bg-[#e8605a] rounded-xl h-12 text-base font-bold gap-2"
          >
            <ArrowRight className="w-5 h-5" />
            {booking ? "Join Lesson" : "Enter Demo Classroom"}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            {booking
              ? "Your teacher and lesson materials will be waiting inside."
              : "Explore the classroom without an active booking."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Live Room ─────────────────────────────────────────────────────────────────
function LiveRoom({ booking, user, initialMic, initialCam, onLeave }) {
  const [micOn, setMicOn] = useState(initialMic);
  const [camOn, setCamOn] = useState(initialCam);
  const [lesson, setLesson] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const localVideoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  useEffect(() => {
    startCamera();
    if (booking) loadLesson();
    else setLoading(false);
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      if (localVideoRef.current) localVideoRef.current.srcObject = s;
      s.getVideoTracks().forEach(t => { t.enabled = initialCam; });
      s.getAudioTracks().forEach(t => { t.enabled = initialMic; });
    } catch {}
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
  };

  const toggleMic = () => {
    if (stream) stream.getAudioTracks().forEach(t => { t.enabled = !micOn; });
    setMicOn(v => !v);
  };

  const toggleCam = () => {
    if (stream) stream.getVideoTracks().forEach(t => { t.enabled = !camOn; });
    setCamOn(v => !v);
  };

  const loadLesson = async () => {
    if (booking.lesson_id) {
      const lessons = await base44.entities.AILesson.filter({ booking_id: booking.id });
      if (lessons[0]) setLesson(lessons[0]);
    }
    setLoading(false);
  };

  const generateLesson = async () => {
    if (!booking) return;
    setGenerating(true);
    const profiles = await base44.entities.StudentProfile.filter({ user_email: booking.student_email });
    const profile = profiles[0];
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Create a detailed English lesson plan for a student with the following profile:
- Level: ${profile?.english_level || booking.student_level || "intermediate"}
- Profession: ${profile?.job || "Not specified"}
- Interests: ${profile?.interests?.join(", ") || "General"}
- Learning Goals: ${profile?.learning_goals || "General improvement"}
- Session Duration: ${booking.session_duration} minutes

Create an engaging, personalized lesson with vocabulary related to their profession/interests, 
grammar points appropriate for their level, practical exercises, and conversation topics.`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          objectives: { type: "array", items: { type: "string" } },
          vocabulary: { type: "array", items: { type: "object", properties: { word: { type: "string" }, definition: { type: "string" }, example: { type: "string" } } } },
          grammar_points: { type: "array", items: { type: "object", properties: { rule: { type: "string" }, explanation: { type: "string" }, examples: { type: "array", items: { type: "string" } } } } },
          exercises: { type: "array", items: { type: "object", properties: { type: { type: "string" }, instruction: { type: "string" }, content: { type: "string" }, answer: { type: "string" } } } },
          conversation_topics: { type: "array", items: { type: "string" } },
          homework: { type: "string" }
        }
      }
    });
    const newLesson = await base44.entities.AILesson.create({
      student_email: booking.student_email,
      booking_id: booking.id,
      title: response.title,
      level: profile?.english_level || booking.student_level,
      objectives: response.objectives,
      vocabulary: response.vocabulary,
      grammar_points: response.grammar_points,
      exercises: response.exercises,
      conversation_topics: response.conversation_topics,
      homework: response.homework,
      status: "ready"
    });
    await base44.entities.Booking.update(booking.id, { lesson_id: newLesson.id });
    setLesson(newLesson);
    setGenerating(false);
  };

  const handleLeave = () => {
    stopCamera();
    onLeave();
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1a1b4b]">
            {booking
              ? (isTeacher ? `Lesson · ${booking.student_name}` : "Your Lesson")
              : "Demo Classroom"}
          </h1>
          {booking && (
            <p className="text-gray-400 text-xs mt-0.5">
              {booking.date} · {booking.start_time?.slice(0,5)}–{booking.end_time?.slice(0,5)} · {booking.session_duration} min
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-600 text-xs font-semibold">LIVE</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Video area */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Main remote video (placeholder) */}
          <div className="relative bg-[#1a1b4b] rounded-2xl overflow-hidden aspect-video">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                <Users className="w-8 h-8 text-white/40" />
              </div>
              <p className="text-white/50 text-sm">
                {isTeacher ? `Waiting for ${booking?.student_name?.split(" ")[0] || "student"}…` : "Waiting for teacher…"}
              </p>
              <p className="text-white/25 text-xs">Connect via your preferred video app (Zoom, Meet, etc.)</p>
            </div>

            {/* Self-view PiP */}
            <div className="absolute bottom-3 right-3 w-32 h-20 bg-[#2d2f6e] rounded-xl overflow-hidden border-2 border-white/20">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${camOn ? "opacity-100" : "opacity-0"}`}
              />
              {!camOn && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/60 text-xs">Cam off</span>
                </div>
              )}
              <div className="absolute bottom-1 left-1 text-[9px] text-white/60 bg-black/40 rounded px-1">You</div>
            </div>
          </div>

          {/* Control bar */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-center gap-3">
            <button
              onClick={toggleMic}
              title={micOn ? "Mute" : "Unmute"}
              className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                micOn ? "bg-white border-gray-200 text-gray-700 hover:border-gray-300" : "bg-red-500 border-red-500 text-white"
              }`}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleCam}
              title={camOn ? "Stop camera" : "Start camera"}
              className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                camOn ? "bg-white border-gray-200 text-gray-700 hover:border-gray-300" : "bg-red-500 border-red-500 text-white"
              }`}
            >
              {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button
              onClick={handleLeave}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 border-2 border-red-500 text-white transition-all"
              title="Leave"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lesson panel */}
        <div className="lg:col-span-1 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
            </div>
          ) : !booking ? (
            <Card className="border-0 shadow-sm flex-1">
              <CardContent className="p-8 text-center flex flex-col items-center justify-center h-full gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#1a1b4b]/5 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-[#1a1b4b]/30" />
                </div>
                <div>
                  <p className="font-semibold text-[#1a1b4b]">Demo Mode</p>
                  <p className="text-sm text-gray-400 mt-1">Book a lesson to unlock AI lesson plans and materials</p>
                </div>
              </CardContent>
            </Card>
          ) : !lesson ? (
            <Card className="border-0 shadow-sm flex-1">
              <CardContent className="p-6 text-center flex flex-col items-center justify-center h-full gap-4">
                <Sparkles className="w-10 h-10 text-[#f97066]" />
                <div>
                  <p className="font-bold text-[#1a1b4b]">AI Lesson Plan</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {isTeacher
                      ? `Generate a personalized plan for ${booking.student_name?.split(" ")[0]}`
                      : "Your teacher will generate the lesson plan"}
                  </p>
                </div>
                {isTeacher && (
                  <Button
                    onClick={generateLesson}
                    disabled={generating}
                    className="bg-[#f97066] hover:bg-[#e8605a] rounded-full w-full gap-2"
                  >
                    {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><Sparkles className="w-4 h-4" /> Generate Plan</>}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm flex-1 overflow-hidden">
              <CardHeader className="pb-2 shrink-0">
                <CardTitle className="text-sm leading-tight">{lesson.title}</CardTitle>
                <div className="flex flex-wrap gap-1 mt-1">
                  {lesson.objectives?.slice(0,2).map((obj, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] rounded-full px-2 py-0">{obj}</Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-520px)] min-h-[200px] px-4 pb-4">
                  <Tabs defaultValue="vocab">
                    <TabsList className="w-full bg-gray-100 rounded-xl mb-3">
                      <TabsTrigger value="vocab" className="text-xs flex-1 rounded-lg">Vocab</TabsTrigger>
                      <TabsTrigger value="grammar" className="text-xs flex-1 rounded-lg">Grammar</TabsTrigger>
                      <TabsTrigger value="exercises" className="text-xs flex-1 rounded-lg">Exercises</TabsTrigger>
                      <TabsTrigger value="talk" className="text-xs flex-1 rounded-lg">Talk</TabsTrigger>
                    </TabsList>

                    <TabsContent value="vocab" className="space-y-2 mt-0">
                      {lesson.vocabulary?.map((w, i) => (
                        <div key={i} className="p-2.5 bg-gray-50 rounded-xl">
                          <p className="font-semibold text-[#1a1b4b] text-sm">{w.word}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{w.definition}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 italic">"{w.example}"</p>
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="grammar" className="space-y-2 mt-0">
                      {lesson.grammar_points?.map((g, i) => (
                        <div key={i} className="p-2.5 bg-gray-50 rounded-xl">
                          <p className="font-semibold text-[#1a1b4b] text-sm">{g.rule}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{g.explanation}</p>
                          {g.examples?.map((ex, j) => (
                            <p key={j} className="text-[11px] text-[#f97066] mt-0.5">• {ex}</p>
                          ))}
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="exercises" className="space-y-2 mt-0">
                      {lesson.exercises?.map((ex, i) => (
                        <div key={i} className="p-2.5 bg-gray-50 rounded-xl">
                          <Badge variant="outline" className="text-[10px] mb-1.5 rounded-full">{ex.type}</Badge>
                          <p className="text-sm font-medium text-[#1a1b4b]">{ex.instruction}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{ex.content}</p>
                          <details className="mt-1.5">
                            <summary className="text-[11px] text-[#f97066] cursor-pointer">Show answer</summary>
                            <p className="text-xs text-gray-600 mt-1">{ex.answer}</p>
                          </details>
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="talk" className="space-y-2 mt-0">
                      {lesson.conversation_topics?.map((t, i) => (
                        <div key={i} className="p-2.5 bg-gray-50 rounded-xl flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-[#f97066] mt-0.5 shrink-0" />
                          <p className="text-sm text-[#1a1b4b]">{t}</p>
                        </div>
                      ))}
                      {lesson.homework && (
                        <div className="p-3 bg-[#1a1b4b] rounded-xl mt-2">
                          <p className="text-[10px] text-white/50 mb-0.5">Homework</p>
                          <p className="text-sm text-white">{lesson.homework}</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ClassroomTab export ─────────────────────────────────────────────────
export default function ClassroomTab({ user, bookingId: initialBookingId }) {
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = initialBookingId || urlParams.get("bookingId");

  const [stage, setStage] = useState("lobby"); // "lobby" | "live"
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(!!bookingId);
  const [joinSettings, setJoinSettings] = useState({ micOn: true, camOn: true });

  useEffect(() => {
    if (bookingId) loadBooking();
  }, [bookingId]);

  const loadBooking = async () => {
    const bookings = await base44.entities.Booking.filter({});
    const found = bookings.find(b => b.id === bookingId);
    setBooking(found || null);
    setLoading(false);
  };

  const handleJoin = (settings) => {
    setJoinSettings(settings);
    setStage("live");
  };

  const handleLeave = () => {
    setStage("lobby");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  if (stage === "lobby") {
    return <Lobby booking={booking} user={user} onJoin={handleJoin} />;
  }

  return (
    <LiveRoom
      booking={booking}
      user={user}
      initialMic={joinSettings.micOn}
      initialCam={joinSettings.camOn}
      onLeave={handleLeave}
    />
  );
}