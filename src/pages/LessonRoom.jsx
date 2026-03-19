import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Video, BookOpen, ChevronDown, ChevronUp, Loader2, MessageSquare, Mic, MicOff, VideoIcon, VideoOff, PhoneOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";

export default function LessonRoom() {
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get("bookingId");

  const [booking, setBooking] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    if (!bookingId) return;
    const bookings = await base44.entities.Booking.filter({});
    const found = bookings.find(b => b.id === bookingId);
    if (found) {
      setBooking(found);
      if (found.lesson_id) {
        const lessons = await base44.entities.AILesson.filter({});
        const foundLesson = lessons.find(l => l.id === found.lesson_id);
        if (foundLesson) setLesson(foundLesson);
      }
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
- Level: ${profile?.english_level || booking.student_level}
- Profession: ${profile?.job || 'Not specified'}
- Interests: ${profile?.interests?.join(', ') || 'General'}
- Learning Goals: ${profile?.learning_goals || 'General improvement'}
- Session Duration: ${booking.session_duration} minutes

Create an engaging, personalized lesson with vocabulary related to their profession/interests, 
grammar points appropriate for their level, practical exercises, and conversation topics they'd enjoy.`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          objectives: { type: "array", items: { type: "string" } },
          vocabulary: {
            type: "array",
            items: {
              type: "object",
              properties: {
                word: { type: "string" },
                definition: { type: "string" },
                example: { type: "string" }
              }
            }
          },
          grammar_points: {
            type: "array",
            items: {
              type: "object",
              properties: {
                rule: { type: "string" },
                explanation: { type: "string" },
                examples: { type: "array", items: { type: "string" } }
              }
            }
          },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                instruction: { type: "string" },
                content: { type: "string" },
                answer: { type: "string" }
              }
            }
          },
          conversation_topics: { type: "array", items: { type: "string" } },
          homework: { type: "string" }
        }
      }
    });

    const newLesson = await base44.entities.AILesson.create({
      student_email: booking.student_email,
      booking_id: bookingId,
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

    await base44.entities.Booking.update(bookingId, { lesson_id: newLesson.id });
    setLesson(newLesson);
    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Lesson not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1b4b]">Lesson Room</h1>
          <p className="text-gray-400 text-sm">
            {booking.date} • {booking.start_time} - {booking.end_time} • {booking.session_duration} min
          </p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 rounded-full">{booking.student_level?.replace(/_/g, ' ')}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Area */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="aspect-video bg-[#1a1b4b] relative flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <VideoIcon className="w-8 h-8 text-white/50" />
                </div>
                <p className="text-white/60 text-sm">Video will connect when the session begins</p>
                <p className="text-white/30 text-xs mt-1">Use your preferred video calling tool to join</p>
              </div>
              
              {/* Self camera preview */}
              <div className="absolute bottom-4 right-4 w-36 h-24 bg-[#2a2b5b] rounded-xl border-2 border-white/10 flex items-center justify-center">
                <p className="text-white/40 text-xs">You</p>
              </div>
            </div>

            {/* Controls */}
            <div className="p-4 flex items-center justify-center gap-3 bg-white">
              <Button
                size="sm"
                variant={micOn ? "outline" : "destructive"}
                className="rounded-full w-12 h-12"
                onClick={() => setMicOn(!micOn)}
              >
                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </Button>
              <Button
                size="sm"
                variant={camOn ? "outline" : "destructive"}
                className="rounded-full w-12 h-12"
                onClick={() => setCamOn(!camOn)}
              >
                {camOn ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="destructive" className="rounded-full w-12 h-12">
                <PhoneOff className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Lesson Content Panel */}
        <div className="lg:col-span-1">
          {!lesson ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <Sparkles className="w-12 h-12 text-[#f97066] mx-auto mb-4" />
                <h3 className="font-bold text-[#1a1b4b] mb-2">AI Lesson</h3>
                <p className="text-sm text-gray-400 mb-6">
                  Generate a personalized lesson based on {booking.student_name}'s profile
                </p>
                <Button
                  onClick={generateLesson}
                  disabled={generating}
                  className="bg-[#f97066] hover:bg-[#e8605a] rounded-full w-full"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Generate Lesson</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{lesson.title}</CardTitle>
                <div className="flex gap-2 flex-wrap mt-2">
                  {lesson.objectives?.map((obj, i) => (
                    <Badge key={i} variant="outline" className="text-xs rounded-full">{obj}</Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-400px)]">
                  <Tabs defaultValue="vocab" className="w-full">
                    <TabsList className="w-full bg-gray-100 rounded-xl mb-4">
                      <TabsTrigger value="vocab" className="text-xs rounded-lg flex-1">Vocab</TabsTrigger>
                      <TabsTrigger value="grammar" className="text-xs rounded-lg flex-1">Grammar</TabsTrigger>
                      <TabsTrigger value="exercises" className="text-xs rounded-lg flex-1">Exercises</TabsTrigger>
                      <TabsTrigger value="talk" className="text-xs rounded-lg flex-1">Talk</TabsTrigger>
                    </TabsList>

                    <TabsContent value="vocab" className="space-y-3">
                      {lesson.vocabulary?.map((word, i) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-xl">
                          <p className="font-semibold text-[#1a1b4b]">{word.word}</p>
                          <p className="text-sm text-gray-500">{word.definition}</p>
                          <p className="text-xs text-gray-400 mt-1 italic">"{word.example}"</p>
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="grammar" className="space-y-3">
                      {lesson.grammar_points?.map((point, i) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-xl">
                          <p className="font-semibold text-[#1a1b4b]">{point.rule}</p>
                          <p className="text-sm text-gray-500 mt-1">{point.explanation}</p>
                          {point.examples?.map((ex, j) => (
                            <p key={j} className="text-xs text-[#f97066] mt-1">• {ex}</p>
                          ))}
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="exercises" className="space-y-3">
                      {lesson.exercises?.map((ex, i) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-xl">
                          <Badge variant="outline" className="text-xs mb-2 rounded-full">{ex.type}</Badge>
                          <p className="text-sm font-medium text-[#1a1b4b]">{ex.instruction}</p>
                          <p className="text-sm text-gray-500 mt-1">{ex.content}</p>
                          <details className="mt-2">
                            <summary className="text-xs text-[#f97066] cursor-pointer">Show answer</summary>
                            <p className="text-xs text-gray-600 mt-1">{ex.answer}</p>
                          </details>
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="talk" className="space-y-3">
                      {lesson.conversation_topics?.map((topic, i) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-xl flex items-start gap-3">
                          <MessageSquare className="w-4 h-4 text-[#f97066] mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-[#1a1b4b]">{topic}</p>
                        </div>
                      ))}
                      {lesson.homework && (
                        <div className="p-4 bg-[#1a1b4b] rounded-xl mt-4">
                          <p className="text-xs text-white/60 mb-1">Homework</p>
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