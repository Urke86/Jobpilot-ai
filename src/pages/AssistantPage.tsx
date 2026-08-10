import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ClipboardList,
  Copy,
  FileText,
  Loader2,
  Mic,
  PenTool,
  Plus,
  Search,
  Send,
  Square,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useResource } from '@/hooks/use-resource';
import {
  createConversation,
  getConversation,
  listApplications,
  listConversations,
  listJobs,
  listMessages,
  streamAssistantMessage,
  updateConversation,
  type AiConversation,
  type AiMessage,
  type AssistantContextType,
} from '@/services';

interface QuickAction {
  label: string;
  description: string;
  icon: React.ElementType;
  starterMessage: string;
}

const quickActions: QuickAction[] = [
  {
    label: 'Job Analysis',
    description: 'Discuss fit for a selected job',
    icon: Search,
    starterMessage:
      'Based on my profile and the selected job context, how well do I fit and what are the main gaps?',
  },
  {
    label: 'CV Optimization',
    description: 'Tailor positioning for a role',
    icon: FileText,
    starterMessage:
      'How should I position my CV for this role using only my demonstrated experience?',
  },
  {
    label: 'Cover Letter',
    description: 'Guidance (use Toolkit for full draft)',
    icon: PenTool,
    starterMessage:
      'Outline a factual cover letter angle for this role. Remind me to use the Application Toolkit for a full draft.',
  },
  {
    label: 'Questionnaire Prep',
    description: 'Draft approach for form answers',
    icon: ClipboardList,
    starterMessage:
      'Help me answer an application questionnaire question using only evidence from my profile and CV.',
  },
  {
    label: 'Interview Prep',
    description: 'Practice with known gaps',
    icon: Mic,
    starterMessage:
      'What interview questions should I expect for this role given my strengths and gaps?',
  },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AssistantPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [contextType, setContextType] = useState<AssistantContextType>('none');
  const [contextJobId, setContextJobId] = useState<string>('');
  const [contextAppId, setContextAppId] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastFailedRef = useRef<string | null>(null);
  const streamBufferRef = useRef('');
  const streamFlushRafRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);

  const {
    data: conversations,
    refetch: refetchConversations,
  } = useResource(listConversations, []);

  const { data: jobs } = useResource(listJobs, []);
  const { data: applications } = useResource(listApplications, []);

  const activeConversation = useMemo(
    () => conversations?.find((c) => c.id === conversationId) ?? null,
    [conversations, conversationId],
  );

  const jobTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs ?? []) {
      map.set(job.id, `${job.job_title} · ${job.company_name_snapshot}`);
    }
    return map;
  }, [jobs]);

  const flushStreamBuffer = useCallback(() => {
    streamFlushRafRef.current = null;
    if (!streamBufferRef.current) return;
    const chunk = streamBufferRef.current;
    streamBufferRef.current = '';
    setStreamText((prev) => prev + chunk);
  }, []);

  const queueStreamToken = useCallback(
    (token: string) => {
      streamBufferRef.current += token;
      if (streamFlushRafRef.current == null) {
        streamFlushRafRef.current = window.requestAnimationFrame(flushStreamBuffer);
      }
    },
    [flushStreamBuffer],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamText, streaming]);

  useEffect(() => {
    return () => {
      if (streamFlushRafRef.current != null) {
        cancelAnimationFrame(streamFlushRafRef.current);
      }
    };
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setConversationId(id);
    setError(null);
    setStreamText('');
    try {
      const [rows, conv] = await Promise.all([
        listMessages(id),
        getConversation(id),
      ]);
      setMessages(rows);
      if (conv) {
        setContextType((conv.context_type as AssistantContextType) || 'none');
        setContextJobId(conv.context_job_id ?? '');
        setContextAppId(conv.context_application_id ?? '');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load messages');
    }
  }, []);

  const openConversation = useCallback(async (conv: AiConversation) => {
    await loadConversation(conv.id);
  }, [loadConversation]);

  useEffect(() => {
    if (!conversationId && conversations && conversations.length > 0) {
      void openConversation(conversations[0]);
    }
  }, [conversations, conversationId, openConversation]);

  const startNewConversation = async () => {
    try {
      const conv = await createConversation({
        contextType,
        contextJobId: contextType === 'job' ? contextJobId || null : null,
        contextApplicationId:
          contextType === 'application' ? contextAppId || null : null,
      });
      refetchConversations();
      await openConversation(conv);
      toast.success('New conversation started');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not create conversation',
      );
    }
  };

  const applyContext = async () => {
    if (!conversationId) {
      await startNewConversation();
      return;
    }
    try {
      const updated = await updateConversation(conversationId, {
        contextType,
        contextJobId: contextType === 'job' ? contextJobId || null : null,
        contextApplicationId:
          contextType === 'application' ? contextAppId || null : null,
      });
      refetchConversations();
      setContextType((updated.context_type as AssistantContextType) || 'none');
      toast.success('Context updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Context update failed');
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || streaming) return;

    let activeId = conversationId;
    if (!activeId) {
      try {
        const conv = await createConversation({
          contextType,
          contextJobId: contextType === 'job' ? contextJobId || null : null,
          contextApplicationId:
            contextType === 'application' ? contextAppId || null : null,
        });
        activeId = conv.id;
        setConversationId(conv.id);
        refetchConversations();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not start conversation',
        );
        return;
      }
    }

    setInput('');
    setError(null);
    setStreaming(true);
    streamBufferRef.current = '';
    if (streamFlushRafRef.current != null) {
      cancelAnimationFrame(streamFlushRafRef.current);
      streamFlushRafRef.current = null;
    }
    setStreamText('');
    stickToBottomRef.current = true;
    lastFailedRef.current = trimmed;

    const controller = new AbortController();
    abortRef.current = controller;

    const clearStreamUi = () => {
      streamBufferRef.current = '';
      if (streamFlushRafRef.current != null) {
        cancelAnimationFrame(streamFlushRafRef.current);
        streamFlushRafRef.current = null;
      }
      setStreamText('');
    };

    try {
      await streamAssistantMessage(activeId, trimmed, {
        signal: controller.signal,
        onUserMessage: (msg) => {
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
        },
        onToken: (token) => {
          queueStreamToken(token);
        },
        onDone: (msg) => {
          flushStreamBuffer();
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
          clearStreamUi();
          setStreaming(false);
          lastFailedRef.current = null;
          refetchConversations();
        },
        onError: (message) => {
          setError(message);
          setStreaming(false);
          clearStreamUi();
          toast.error(message);
        },
      });
      // If stream ended without done (rare), clear streaming
      setStreaming(false);
      clearStreamUi();
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setStreaming(false);
        clearStreamUi();
        return;
      }
      const message =
        err instanceof Error ? err.message : 'Assistant request failed.';
      setError(message);
      setStreaming(false);
      clearStreamUi();
      toast.error(message);
    } finally {
      abortRef.current = null;
    }
  };

  const retry = () => {
    if (lastFailedRef.current && !streaming) {
      void sendMessage(lastFailedRef.current);
    }
  };

  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Contextual help with your jobs, applications, and profile evidence
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          onClick={() => void startNewConversation()}
          disabled={streaming}
        >
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Focus</Label>
                <Select
                  value={contextType}
                  onValueChange={(v) =>
                    setContextType(v as AssistantContextType)
                  }
                  disabled={streaming}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific context</SelectItem>
                    <SelectItem value="job">Job</SelectItem>
                    <SelectItem value="application">Application</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {contextType === 'job' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Job</Label>
                  <Select
                    value={contextJobId || undefined}
                    onValueChange={setContextJobId}
                    disabled={streaming}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select job" />
                    </SelectTrigger>
                    <SelectContent>
                      {(jobs ?? []).map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.job_title} · {job.company_name_snapshot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {contextType === 'application' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Application</Label>
                  <Select
                    value={contextAppId || undefined}
                    onValueChange={setContextAppId}
                    disabled={streaming}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select application" />
                    </SelectTrigger>
                    <SelectContent>
                      {(applications ?? []).map((app) => (
                        <SelectItem key={app.id} value={app.id}>
                          {jobTitleById.get(app.job_id) ?? 'Job'} · {app.stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => void applyContext()}
                disabled={streaming}
              >
                Apply context
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="max-h-56 space-y-1 overflow-y-auto">
              {(conversations ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No conversations yet.
                </p>
              ) : (
                (conversations ?? []).map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => void openConversation(conv)}
                    className={`w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted/60 ${
                      conversationId === conv.id ? 'border-primary' : ''
                    }`}
                  >
                    <p className="line-clamp-1 font-medium">{conv.title}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {conv.context_type} ·{' '}
                      {new Date(conv.updated_at).toLocaleDateString()}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

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
                    type="button"
                    onClick={() => void sendMessage(action.starterMessage)}
                    disabled={streaming}
                    className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 disabled:opacity-50"
                  >
                    <div className="mt-0.5 rounded-md bg-primary/10 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {action.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 flex flex-col lg:col-span-3">
          <Card className="flex flex-1 flex-col">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                {activeConversation?.title ?? 'Assistant'}
              </CardTitle>
            </CardHeader>
            <ScrollArea className="h-[calc(100vh-320px)] flex-1" ref={scrollRef}>
              <div
                className="space-y-4 p-4"
                onScroll={(e) => {
                  const t = e.currentTarget;
                  const distance =
                    t.scrollHeight - t.scrollTop - t.clientHeight;
                  stickToBottomRef.current = distance < 80;
                }}
              >
                {messages.length === 0 && !streaming ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-sm text-muted-foreground">
                    <Bot className="h-8 w-8" />
                    <p>
                      Ask about fit, gaps, CV positioning, questionnaires, or
                      interviews.
                    </p>
                    <p className="text-xs">
                      Answers use only your saved JobPilot evidence.
                    </p>
                  </div>
                ) : null}

                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`flex max-w-[85%] items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
                      >
                        <div
                          className={`mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
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
                        <div>
                          <div
                            className={`whitespace-pre-wrap px-3.5 py-2.5 text-sm leading-relaxed ${
                              isUser
                                ? 'rounded-2xl rounded-br-sm bg-primary text-primary-foreground'
                                : 'rounded-2xl rounded-bl-sm bg-muted'
                            }`}
                          >
                            {msg.content}
                          </div>
                          <div
                            className={`mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/60 ${isUser ? 'justify-end' : 'justify-start'}`}
                          >
                            <span>{formatTime(msg.created_at)}</span>
                            {!isUser ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-0.5 hover:text-foreground"
                                onClick={() => void copyMessage(msg.content)}
                              >
                                <Copy className="h-3 w-3" />
                                Copy
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {streaming ? (
                  <div className="flex justify-start">
                    <div className="flex max-w-[85%] items-start gap-2.5">
                      <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed">
                        {streamText || (
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Thinking…
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <p className="font-medium text-destructive">
                      Generation failed
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={retry}
                      disabled={streaming || !lastFailedRef.current}
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <div className="flex items-end gap-2">
                <Label htmlFor="assistant-composer" className="sr-only">
                  Message to JobPilot assistant
                </Label>
                <Textarea
                  id="assistant-composer"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  placeholder="Ask about jobs, applications, or interview prep..."
                  className="min-h-[44px] max-h-[160px] resize-none rounded-xl"
                  rows={1}
                  disabled={streaming}
                />
                {streaming ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-[44px] w-[44px] flex-shrink-0 rounded-xl"
                    onClick={stopGeneration}
                    aria-label="Stop generating"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    className="h-[44px] w-[44px] flex-shrink-0 rounded-xl"
                    onClick={() => void sendMessage(input)}
                    disabled={!input.trim()}
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground/60">
                Uses only your JobPilot profile, CV, and selected context —
                never invents experience
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
