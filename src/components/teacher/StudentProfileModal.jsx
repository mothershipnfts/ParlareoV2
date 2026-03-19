import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, MessageSquare, Send, BookOpen, Clock, AlertCircle } from "lucide-react";

export default function StudentProfileModal({ student, onClose, teacherId }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSendMessage = async () => {
    if (!message.trim() || !student?.id || !teacherId) return;
    
    setSending(true);
    setError(null);
    
    try {
      const { data: convId } = await supabase.rpc("get_or_create_conversation", {
        p_user_1_id: student.id,
        p_user_2_id: teacherId,
      });
      if (convId) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("messages").insert({
          conversation_id: convId,
          sender_id: user.id,
          content: message.trim(),
        });
      }
      setSent(true);
      setMessage("");
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      setError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const levelColors = {
    beginner: "bg-blue-100 text-blue-700",
    elementary: "bg-sky-100 text-sky-700",
    pre_intermediate: "bg-teal-100 text-teal-700",
    intermediate: "bg-emerald-100 text-emerald-700",
    upper_intermediate: "bg-violet-100 text-violet-700",
    advanced: "bg-[#1a1b4b]/10 text-[#1a1b4b]",
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#1a1b4b]">{student.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <CardContent className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Avatar & Basic Info */}
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#1a1b4b]/10 flex items-center justify-center font-bold text-2xl text-[#1a1b4b] mx-auto mb-3">
              {student.name?.[0]?.toUpperCase() || "?"}
            </div>
            <p className="text-sm text-gray-500 break-all">{student.email}</p>
            {student.profile?.job && (
              <p className="text-xs text-gray-400 mt-1">{student.profile.job}</p>
            )}
          </div>

          {/* Level Badge */}
          {student.profile?.english_level && (
            <div className="flex justify-center">
              <Badge className={`rounded-full text-xs capitalize ${levelColors[student.profile.english_level] || "bg-gray-100 text-gray-600"}`}>
                {student.profile.english_level.replace(/_/g, " ")}
              </Badge>
            </div>
          )}

          {/* Learning Goals */}
          {student.profile?.learning_goals && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-1">Learning Goals</h3>
              <p className="text-sm text-gray-600">{student.profile.learning_goals}</p>
            </div>
          )}

          {/* Interests */}
          {student.profile?.interests && student.profile.interests.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-1.5">Interests</h3>
              <div className="flex flex-wrap gap-1.5">
                {student.profile.interests.map((interest, i) => (
                  <Badge key={i} variant="outline" className="text-xs rounded-full">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
                <BookOpen className="w-3 h-3" />
              </div>
              <p className="font-bold text-[#1a1b4b]">{student.completedLessons}</p>
              <p className="text-xs text-gray-400">Completed</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mb-1">
                <Clock className="w-3 h-3" />
              </div>
              <p className="font-bold text-[#1a1b4b]">{(student.totalMinutes / 60).toFixed(1)}h</p>
              <p className="text-xs text-gray-400">Taught</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-[#1a1b4b]">{student.upcomingLessons}</p>
              <p className="text-xs text-gray-400">Upcoming</p>
            </div>
          </div>

          {/* Message Section */}
          <div className="pt-3 border-t border-gray-100 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1a1b4b]">
              <MessageSquare className="w-4 h-4" />
              Send Message
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 p-2 rounded">
                <AlertCircle className="w-3 h-3" /> {error}
              </div>
            )}
            
            {sent && (
              <div className="text-emerald-600 text-xs bg-emerald-50 p-2 rounded">
                ✓ Message sent!
              </div>
            )}
            
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={sending}
                className="text-sm h-9"
              />
              <Button
                onClick={handleSendMessage}
                disabled={sending || !message.trim()}
                size="sm"
                className="bg-[#1a1b4b] hover:bg-[#2a2b5b] px-3"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}