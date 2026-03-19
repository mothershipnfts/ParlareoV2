import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, Loader2, AlertCircle } from "lucide-react";

export default function SendMessageModal({ teacher, user, onClose }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Send the message
      await base44.functions.invoke('sendPrivateMessage', {
        recipientEmail: teacher.user_email,
        content: message.trim(),
      });

      // Redirect to student dashboard with messages tab open
      navigate(createPageUrl('StudentDashboard?tab=messages'));
    } catch (err) {
      setError("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#1a1b4b]">Message {teacher.full_name}</h2>
          <button onClick={onClose} disabled={loading} className="p-1 hover:bg-gray-100 rounded-lg disabled:opacity-50">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <CardContent className="p-5 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-3">Send a message to {teacher.full_name} to introduce yourself or ask any questions.</p>
            
            {error && (
              <div className="flex items-start gap-2 text-red-600 text-sm mb-3 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Textarea
              placeholder="Hi! I'm interested in learning English with you. Are you available next week?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              className="text-sm min-h-[120px] resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={loading || !message.trim()}
              className="flex-1 bg-[#1a1b4b] hover:bg-[#2a2b5b]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}