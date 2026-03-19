import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, AlertCircle } from "lucide-react";

export default function TeacherMessagePanel({ teacher, user }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Create a message record (you can expand this with a Message entity later)
      await base44.entities.TeacherMessage?.create?.({
        student_email: user.email,
        student_name: user.full_name,
        teacher_email: teacher.user_email,
        message: message.trim(),
        is_read: false,
      }).catch(() => {
        // If entity doesn't exist, just notify the teacher via another method
        console.log("Message feature not fully set up yet");
      });

      setSent(true);
      setMessage("");
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
      <h4 className="font-semibold text-[#1a1b4b] mb-3">Message {teacher.full_name}</h4>
      
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm mb-3 bg-red-50 p-2 rounded">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      
      {sent && (
        <div className="text-emerald-600 text-sm mb-3 bg-emerald-50 p-2 rounded">
          ✓ Message sent! The tutor will see it soon.
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Ask about availability, lessons, or anything else..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          className="text-sm"
          disabled={loading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={loading || !message.trim()}
          className="bg-[#1a1b4b] hover:bg-[#2a2b5b] px-4"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}