import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function IntegratedChat({ user }) {
  const [conversations, setConversations] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const mobileMessagesContainerRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    loadConversations();
  }, [user?.id]);

  const loadConversations = async () => {
    try {
      setLoading(true);

      const contactIds = new Set();

      const { data: convs } = await supabase
        .from("conversations")
        .select("id, participant_1_id, participant_2_id")
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`);

      (convs || []).forEach((c) => {
        contactIds.add(c.participant_1_id === user.id ? c.participant_2_id : c.participant_1_id);
      });

      const { data: studentBookings } = await supabase
        .from("bookings")
        .select("teacher_id")
        .eq("student_id", user.id);
      (studentBookings || []).forEach((b) => contactIds.add(b.teacher_id));

      const { data: teacherProfile } = await supabase
        .from("teacher_profiles")
        .select("id")
        .eq("profile_id", user.id)
        .single();
      if (teacherProfile) {
        const { data: teacherBookings } = await supabase
          .from("bookings")
          .select("student_id")
          .eq("teacher_id", user.id);
        (teacherBookings || []).forEach((b) => contactIds.add(b.student_id));
      }

      contactIds.delete(user.id);
      const otherIds = [...contactIds];

      if (otherIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", otherIds);

      const profileMap = {};
      (profiles || []).forEach((p) => { profileMap[p.id] = p; });

      const contactList = [];
      for (const otherId of otherIds) {
        const { data: convId } = await supabase.rpc("get_or_create_conversation", {
          p_user_1_id: user.id,
          p_user_2_id: otherId,
        });
        if (!convId) continue;

        const conv = convs?.find((c) => c.id === convId) || { id: convId };
        const p = profileMap[otherId];

        const { data: lastMsgs } = await supabase
          .from("messages")
          .select("content, created_at")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count: unreadCount } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convId)
          .eq("is_read", false)
          .neq("sender_id", user.id);

        contactList.push({
          id: otherId,
          email: p?.email || "",
          name: p?.full_name || p?.email || "Unknown",
          lastMessage: lastMsgs?.content || "No messages yet",
          lastMessageTime: lastMsgs?.created_at || new Date(0).toISOString(),
          unreadCount: unreadCount ?? 0,
          conversationId: convId,
        });
      }

      contactList.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
      setConversations(contactList);
      if (contactList.length > 0 && !selectedContact) {
        setSelectedContact(contactList[0]);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedContact?.id || !user?.id) return;
    loadMessages();
  }, [selectedContact?.id, user?.id]);

  const loadMessages = async () => {
    if (!selectedContact?.conversationId) return;
    try {
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, sender_id, content, is_read, created_at")
        .eq("conversation_id", selectedContact.conversationId)
        .order("created_at", { ascending: true });

      setMessages(msgs || []);

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", selectedContact.conversationId)
        .neq("sender_id", user.id)
        .eq("is_read", false);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedContact?.conversationId) return;

    const content = messageText.trim();
    setMessageText("");

    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      sender_id: user.id,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    setSending(true);
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedContact.conversationId,
        sender_id: user.id,
        content,
      });
      if (error) throw error;
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setMessageText(content);
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const msg = payload.new;
          const conv = conversations.find((c) => c.conversationId === msg.conversation_id);
          if (conv && (conv.id === selectedContact?.id || msg.sender_id !== user.id)) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              const withoutOptimistic = msg.sender_id === user.id
                ? prev.filter((m) => !String(m.id).startsWith("optimistic-"))
                : prev;
              return [...withoutOptimistic, msg].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, conversations, selectedContact?.id]);

  useEffect(() => {
    const behavior = messages.length > 0 ? "smooth" : "instant";
    const timer = setTimeout(() => {
      if (messagesContainerRef.current) messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      if (mobileMessagesContainerRef.current) mobileMessagesContainerRef.current.scrollTop = mobileMessagesContainerRef.current.scrollHeight;
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, selectedContact?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[600px] md:h-[700px]">
      <Card className="w-full md:w-80 flex flex-col border-0 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#1a1b4b]">Messages</h2>
          <p className="text-xs text-gray-400 mt-1">{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MessageSquare className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No conversations yet</p>
              <p className="text-xs text-gray-300 mt-1">Start messaging with a teacher or student</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={cn(
                    "w-full p-3 rounded-lg text-left transition-all",
                    selectedContact?.id === contact.id
                      ? "bg-[#1a1b4b]/10 border border-[#1a1b4b]/20"
                      : "hover:bg-gray-50 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-[#1a1b4b]/10 flex items-center justify-center font-bold text-[#1a1b4b] text-sm shrink-0">
                      {contact.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1a1b4b] truncate">{contact.name}</p>
                      <p className="text-xs text-gray-500 truncate">{contact.lastMessage}</p>
                    </div>
                    {contact.unreadCount > 0 && (
                      <span className="bg-[#f97066] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shrink-0">
                        {contact.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="flex-1 hidden md:flex flex-col border-0 shadow-sm">
        {selectedContact ? (
          <>
            <div className="p-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-[#1a1b4b]">{selectedContact.name}</p>
              <p className="text-xs text-gray-400">{selectedContact.email}</p>
            </div>
            <CardContent ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <p className="text-sm text-gray-400">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.sender_id === user.id ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-xs px-4 py-2 rounded-lg text-sm",
                        msg.sender_id === user.id ? "bg-[#1a1b4b] text-white rounded-br-none" : "bg-gray-100 text-[#1a1b4b] rounded-bl-none"
                      )}
                    >
                      <p className="break-words">{msg.content}</p>
                      <p className={cn("text-xs mt-1", msg.sender_id === user.id ? "text-white/70" : "text-gray-500")}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </CardContent>
            <div className="p-4 border-t border-gray-100">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  disabled={sending}
                  className="text-sm"
                />
                <Button onClick={handleSendMessage} disabled={sending || !messageText.trim()} className="bg-[#1a1b4b] hover:bg-[#2a2b5b] px-4">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">Select a conversation to start messaging</p>
          </div>
        )}
      </Card>

      {selectedContact && (
        <Card className="flex-1 md:hidden flex flex-col border-0 shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <button onClick={() => setSelectedContact(null)} className="text-sm text-[#1a1b4b] font-semibold mb-1">← Back</button>
            <p className="text-sm font-semibold text-[#1a1b4b]">{selectedContact.name}</p>
            <p className="text-xs text-gray-400">{selectedContact.email}</p>
          </div>
          <CardContent ref={mobileMessagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.sender_id === user.id ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-xs px-4 py-2 rounded-lg text-sm",
                    msg.sender_id === user.id ? "bg-[#1a1b4b] text-white rounded-br-none" : "bg-gray-100 text-[#1a1b4b] rounded-bl-none"
                  )}
                >
                  <p className="break-words">{msg.content}</p>
                  <p className={cn("text-xs mt-1", msg.sender_id === user.id ? "text-white/70" : "text-gray-500")}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </CardContent>
          <div className="p-4 border-t border-gray-100">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                disabled={sending}
                className="text-sm"
              />
              <Button onClick={handleSendMessage} disabled={sending || !messageText.trim()} className="bg-[#1a1b4b] hover:bg-[#2a2b5b] px-4">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
