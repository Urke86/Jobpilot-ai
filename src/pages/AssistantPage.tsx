import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  FileText,
  PenTool,
  ClipboardList,
  Mic,
  Send,
  Bot,
  User,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { ChatMessage } from '../types';

// ---------------------------------------------------------------------------
// Quick‑action definitions
// ---------------------------------------------------------------------------

interface QuickAction {
  label: string;
  description: string;
  icon: React.ElementType;
  starterMessage: string;
}

const quickActions: QuickAction[] = [
  {
    label: 'Job Analysis',
    description: 'Analyze a job listing for fit',
    icon: Search,
    starterMessage:
      'Can you analyze this job listing and tell me how well it matches my profile?',
  },
  {
    label: 'CV Optimization',
    description: 'Tailor your resume',
    icon: FileText,
    starterMessage:
      "I'd like to optimize my CV for a specific role. Can you help me tailor it?",
  },
  {
    label: 'Cover Letter',
    description: 'Generate a cover letter',
    icon: PenTool,
    starterMessage:
      "Please help me write a compelling cover letter for a position I'm applying to.",
  },
  {
    label: 'Questionnaire Prep',
    description: 'Prepare for application forms',
    icon: ClipboardList,
    starterMessage:
      'I have a job application questionnaire to fill out. Can you help me craft strong answers?',
  },
  {
    label: 'Interview Prep',
    description: 'Practice interview questions',
    icon: Mic,
    starterMessage:
      'I have an upcoming interview. Can you help me prepare with some practice questions?',
  },
];

// ---------------------------------------------------------------------------
// Canned assistant responses
// ---------------------------------------------------------------------------

const cannedResponses = [
  "That's a great question! Based on your profile as a Senior Frontend Engineer, I'd recommend focusing on highlighting your React and TypeScript expertise. Would you like me to draft some specific talking points?",
  "I've analyzed the key requirements. Here are the top areas where your experience aligns well:\n\n• **Frontend architecture** – your 5+ years of React experience is a strong match\n• **TypeScript** – listed as required, and you have extensive experience\n• **Team leadership** – your mentoring background covers their lead expectations\n\nWould you like me to go deeper on any of these?",
  "Absolutely, I can help with that! Let me put together a tailored approach. In the meantime, could you share the job description or any specific details you'd like me to focus on?",
  "Here's a structured preparation plan:\n\n1. **Research the company** – review their engineering blog and recent product launches\n2. **Review common questions** – I'll generate role-specific questions for you\n3. **Prepare your stories** – use the STAR method for behavioral questions\n4. **Technical prep** – focus on system design and coding challenges\n\nShall we start with any of these areas?",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextId = 10;
function createMessage(
  role: ChatMessage['role'],
  content: string,
): ChatMessage {
  return {
    id: String(nextId++),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Initial messages (welcome + example conversation)
// ---------------------------------------------------------------------------

const initialMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content:
      "Hello! I'm your AI job search assistant. I can help you analyze job listings, optimize your CV, generate cover letters, prepare for questionnaires, and practice for interviews. What would you like help with?",
    timestamp: '2025-01-15T09:00:00Z',
  },
  {
    id: '2',
    role: 'user',
    content:
      'I found a Senior Frontend Engineer role at Supabase. Can you analyze it for me?',
    timestamp: '2025-01-15T09:01:30Z',
  },
  {
    id: '3',
    role: 'assistant',
    content:
      "Great choice! Supabase is an excellent company with a strong engineering culture. Here's my analysis of the role:\n\n**Match Score: 92%** 🎯\n\n**Strong Matches:**\n• React & TypeScript – core requirements that align perfectly with your experience\n• Open-source contribution – Supabase values this, and you have several OSS projects\n• Remote-first culture – matches your preference for fully remote work\n\n**Areas to Highlight:**\n• Your experience with real-time data and WebSocket integrations\n• Performance optimization work on large-scale dashboards\n\n**Potential Gaps:**\n• PostgreSQL knowledge – consider brushing up on advanced query patterns\n\nWould you like me to help optimize your CV for this specific role?",
    timestamp: '2025-01-15T09:02:15Z',
  },
  {
    id: '4',
    role: 'user',
    content:
      'Yes, and could you also help me prepare for the technical interview?',
    timestamp: '2025-01-15T09:03:00Z',
  },
  {
    id: '5',
    role: 'assistant',
    content:
      "Absolutely! Let's tackle both. For your **CV**, I'll tailor the summary and experience sections to emphasize Supabase-relevant skills.\n\nFor **interview prep**, here's what to expect based on Supabase's hiring process:\n\n1. **Initial Screen** – culture fit & motivation (30 min)\n2. **Technical Deep Dive** – React architecture, state management, performance (60 min)\n3. **Live Coding** – building a small feature with React + TypeScript (90 min)\n4. **System Design** – designing a real-time dashboard component (45 min)\n\nLet's start with your CV optimization. Can you paste your current summary section?",
    timestamp: '2025-01-15T09:03:45Z',
  },
];

// ---------------------------------------------------------------------------
// AssistantPage
// ---------------------------------------------------------------------------

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto‑scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim() || isTyping) return;

      const userMsg = createMessage('user', content.trim());
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsTyping(true);

      // Mock AI response after a brief delay
      setTimeout(() => {
        const response =
          cannedResponses[Math.floor(Math.random() * cannedResponses.length)];
        const assistantMsg = createMessage('assistant', response);
        setMessages((prev) => [...prev, assistantMsg]);
        setIsTyping(false);
      }, 1200);
    },
    [isTyping],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.starterMessage);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Get help with your job search
        </p>
      </div>

      {/* Two‑column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ---- Left Sidebar: Quick Actions ---- */}
        <div className="col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                    className="w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="mt-0.5 rounded-md bg-primary/10 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {action.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {action.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ---- Right Section: Chat ---- */}
        <div className="col-span-1 lg:col-span-3 flex flex-col">
          <Card className="flex flex-col flex-1">
            {/* Messages area */}
            <ScrollArea
              className="flex-1 h-[calc(100vh-280px)]"
              ref={scrollRef}
            >
              <div className="p-4 space-y-4">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`flex items-start gap-2.5 max-w-[80%] ${isUser ? 'flex-row-reverse' : ''}`}
                      >
                        {/* Avatar */}
                        <div
                          className={`flex-shrink-0 mt-1 flex h-7 w-7 items-center justify-center rounded-full ${
                            isUser
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isUser ? (
                            <User className="h-3.5 w-3.5" />
                          ) : (
                            <Bot className="h-3.5 w-3.5" />
                          )}
                        </div>

                        {/* Bubble + timestamp */}
                        <div>
                          <div
                            className={`px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                              isUser
                                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                                : 'bg-muted rounded-2xl rounded-bl-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <p
                            className={`text-[10px] text-muted-foreground/60 mt-1 ${isUser ? 'text-right' : 'text-left'}`}
                          >
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-start gap-2.5 max-w-[80%]">
                      <div className="flex-shrink-0 mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                        <div className="flex gap-1">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="border-t p-4">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about jobs, applications, or interview prep..."
                  className="min-h-[44px] max-h-[160px] resize-none rounded-xl border-border/60 focus-visible:ring-1"
                  rows={1}
                />
                <Button
                  size="icon"
                  className="h-[44px] w-[44px] rounded-xl flex-shrink-0"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isTyping}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground/50 mt-2 text-center">
                AI responses are simulated for demo purposes
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
