import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
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

  // Load conversations and messages
  useEffect(() => {
    if (!user?.email) return;
    loadConversations();
  }, [user?.email]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const contactMap = {};

      // Get all messages involving this user
      const sentMessages = await base44.entities.Messages.filter({ sender_email: user.email });
      const receivedMessages = await base44.entities.Messages.filter({ recipient_email: user.email });
      const allMessages = [...sentMessages, ...receivedMessages];

      // Build conversation map from messages
      allMessages.forEach(msg => {
        const otherEmail = msg.sender_email === user.email ? msg.recipient_email : msg.sender_email;
        const otherName = msg.sender_email === user.email ? msg.recipient_name : msg.sender_name;
        
        if (!contactMap[otherEmail]) {
          contactMap[otherEmail] = {
            email: otherEmail,
            name: otherName || otherEmail,
            lastMessage: msg.content,
            lastMessageTime: msg.created_date,
            unreadCount: 0,
          };
        }
        
        // Count unread messages from this contact
        if (msg.recipient_email === user.email && !msg.is_read) {
          contactMap[otherEmail].unreadCount += 1;
        }
        
        // Update last message
        if (new Date(msg.created_date) > new Date(contactMap[otherEmail].lastMessageTime)) {
          contactMap[otherEmail].lastMessage = msg.content;
          contactMap[otherEmail].lastMessageTime = msg.created_date;
        }
      });

      // ── For STUDENTS: find booked teachers via availability_id ──
      const studentBookings = await base44.entities.Booking.filter({ student_email: user.email });
      if (studentBookings.length > 0) {
        const availabilityIds = [...new Set(studentBookings.map(b => b.availability_id).filter(Boolean))];
        for (const avId of availabilityIds) {
          const slots = await base44.entities.AvailabilitySlots.filter({ id: avId });
          if (slots.length > 0) {
            const teacherEmail = slots[0].teacher_email;
            if (teacherEmail && !contactMap[teacherEmail]) {
              const teachers = await base44.entities.TeacherProfile.filter({ user_email: teacherEmail });
              if (teachers.length > 0) {
                contactMap[teacherEmail] = {
                  email: teacherEmail,
                  name: teachers[0].full_name,
                  lastMessage: "No messages yet — say hello!",
                  lastMessageTime: new Date(0).toISOString(),
                  unreadCount: 0,
                };
              }
            }
          }
        }
      }

      // ── For TEACHERS: find students who booked their availability slots ──
      const teacherProfile = await base44.entities.TeacherProfile.filter({ user_email: user.email });
      if (teacherProfile.length > 0) {
        const mySlots = await base44.entities.AvailabilitySlots.filter({ teacher_email: user.email });
        const mySlotIds = new Set(mySlots.map(s => s.id));
        const allBookings = await base44.entities.Booking.list();
        const teacherBookings = allBookings.filter(b => mySlotIds.has(b.availability_id));
        const studentEmails = [...new Set(teacherBookings.map(b => b.student_email).filter(Boolean))];
        for (const studentEmail of studentEmails) {
          if (!contactMap[studentEmail]) {
            const students = await base44.entities.StudentProfile.filter({ user_email: studentEmail });
            if (students.length > 0) {
              contactMap[studentEmail] = {
                email: studentEmail,
                name: students[0].full_name,
                lastMessage: "No messages yet",
                lastMessageTime: new Date(0).toISOString(),
                unreadCount: 0,
              };
            } else {
              // Fallback to booking student_name
              const booking = teacherBookings.find(b => b.student_email === studentEmail);
              contactMap[studentEmail] = {
                email: studentEmail,
                name: booking?.student_name || studentEmail,
                lastMessage: "No messages yet",
                lastMessageTime: new Date(0).toISOString(),
                unreadCount: 0,
              };
            }
          }
        }
      }

      const contactList = Object.values(contactMap).sort((a, b) => 
        new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
      );

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

  // Load messages for selected contact
  useEffect(() => {
    if (!selectedContact?.email || !user?.email) return;
    loadMessages();
  }, [selectedContact?.email, user?.email]);

  const loadMessages = async () => {
    try {
      const sentMsgs = await base44.entities.Messages.filter({ 
        sender_email: user.email, 
        recipient_email: selectedContact.email 
      }, "-created_date");
      
      const receivedMsgs = await base44.entities.Messages.filter({ 
        sender_email: selectedContact.email,
        recipient_email: user.email 
      }, "-created_date");

      const allMsgs = [...sentMsgs, ...receivedMsgs].sort((a, b) => 
        new Date(a.created_date) - new Date(b.created_date)
      );

      setMessages(allMsgs);

      // Mark received messages as read
      receivedMsgs.forEach(msg => {
        if (!msg.is_read) {
          base44.entities.Messages.update(msg.id, { is_read: true });
        }
      });
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedContact?.email) return;

    const content = messageText.trim();
    setMessageText("");

    // Optimistically append the message immediately
    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      sender_email: user.email,
      sender_name: user.full_name,
      recipient_email: selectedContact.email,
      recipient_name: selectedContact.name,
      content,
      is_read: false,
      created_date: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);

    setSending(true);
    try {
      await base44.functions.invoke('sendPrivateMessage', {
        recipientEmail: selectedContact.email,
        content,
      });
      // The real message will arrive via subscription and deduplicate by id
    } catch (error) {
      // Roll back on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setMessageText(content);
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  // Keep refs to latest values so the subscription always sees current state
  const selectedContactRef = useRef(selectedContact);
  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Subscribe to new messages — mounted once, never re-subscribes
  useEffect(() => {
    const unsubscribe = base44.entities.Messages.subscribe((event) => {
      if (event.type === "create") {
        const msg = event.data;
        const currentUser = userRef.current;
        const currentContact = selectedContactRef.current;
        const isRelevant = msg.sender_email === currentUser?.email || msg.recipient_email === currentUser?.email;

        if (!isRelevant) return;

        const otherEmail = msg.sender_email === currentUser?.email ? msg.recipient_email : msg.sender_email;
        const otherName = msg.sender_email === currentUser?.email ? msg.recipient_name : msg.sender_name;

        // Append message to current conversation if it's open
        if (currentContact?.email === otherEmail) {
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            // Replace optimistic message if this is from the current user (sender)
            const withoutOptimistic = msg.sender_email === currentUser?.email
              ? prev.filter(m => !m.id?.toString().startsWith('optimistic-'))
              : prev;
            return [...withoutOptimistic, msg].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
          });
          if (msg.recipient_email === currentUser?.email && !msg.is_read) {
            base44.entities.Messages.update(msg.id, { is_read: true });
          }
        }

        // Update conversation list metadata only (no full reload)
        setConversations(prev => {
          const existing = prev.find(c => c.email === otherEmail);
          if (existing) {
            return prev.map(c => c.email === otherEmail
              ? { ...c, lastMessage: msg.content, lastMessageTime: msg.created_date, unreadCount: (currentContact?.email === otherEmail ? 0 : (c.unreadCount || 0) + (msg.recipient_email === currentUser?.email ? 1 : 0)) }
              : c
            ).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
          }
          // New contact appeared
          return [{ email: otherEmail, name: otherName || otherEmail, lastMessage: msg.content, lastMessageTime: msg.created_date, unreadCount: msg.recipient_email === currentUser?.email ? 1 : 0 }, ...prev];
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Scroll to bottom on new messages
  const scrollToBottom = (behavior = "smooth") => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
    if (mobileMessagesContainerRef.current) {
      mobileMessagesContainerRef.current.scrollTop = mobileMessagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    // Instant scroll when switching conversations, smooth on new messages
    const behavior = messages.length > 0 ? "smooth" : "instant";
    const timer = setTimeout(() => scrollToBottom(behavior), 50);
    return () => clearTimeout(timer);
  }, [messages, selectedContact?.email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[600px] md:h-[700px]">
      {/* Contacts Sidebar */}
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
              {conversations.map(contact => (
                <button
                  key={contact.email}
                  onClick={() => setSelectedContact(contact)}
                  className={cn(
                    "w-full p-3 rounded-lg text-left transition-all",
                    selectedContact?.email === contact.email
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

      {/* Chat Pane */}
      <Card className="flex-1 hidden md:flex flex-col border-0 shadow-sm">
        {selectedContact ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-[#1a1b4b]">{selectedContact.name}</p>
              <p className="text-xs text-gray-400">{selectedContact.email}</p>
            </div>

            {/* Messages */}
            <CardContent ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center">
                  <p className="text-sm text-gray-400">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.sender_email === user.email ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-xs px-4 py-2 rounded-lg text-sm",
                        msg.sender_email === user.email
                          ? "bg-[#1a1b4b] text-white rounded-br-none"
                          : "bg-gray-100 text-[#1a1b4b] rounded-bl-none"
                      )}
                    >
                      <p className="break-words">{msg.content}</p>
                      <p className={cn(
                        "text-xs mt-1",
                        msg.sender_email === user.email ? "text-white/70" : "text-gray-500"
                      )}>
                        {new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t border-gray-100">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  disabled={sending}
                  className="text-sm"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sending || !messageText.trim()}
                  className="bg-[#1a1b4b] hover:bg-[#2a2b5b] px-4"
                >
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

      {/* Mobile message view */}
      {selectedContact && (
        <Card className="flex-1 md:hidden flex flex-col border-0 shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <button onClick={() => setSelectedContact(null)} className="text-sm text-[#1a1b4b] font-semibold mb-1">
              ← Back
            </button>
            <p className="text-sm font-semibold text-[#1a1b4b]">{selectedContact.name}</p>
            <p className="text-xs text-gray-400">{selectedContact.email}</p>
          </div>

          {/* Messages */}
          <CardContent ref={mobileMessagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.sender_email === user.email ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-xs px-4 py-2 rounded-lg text-sm",
                    msg.sender_email === user.email
                      ? "bg-[#1a1b4b] text-white rounded-br-none"
                      : "bg-gray-100 text-[#1a1b4b] rounded-bl-none"
                  )}
                >
                  <p className="break-words">{msg.content}</p>
                  <p className={cn(
                    "text-xs mt-1",
                    msg.sender_email === user.email ? "text-white/70" : "text-gray-500"
                  )}>
                    {new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </CardContent>

          {/* Input */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message..."
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                disabled={sending}
                className="text-sm"
              />
              <Button
                onClick={handleSendMessage}
                disabled={sending || !messageText.trim()}
                className="bg-[#1a1b4b] hover:bg-[#2a2b5b] px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}