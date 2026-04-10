"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MarkdownMessage } from "@/components/MarkdownMessage";

interface ChatThread {
  thread_id: string;
  title: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  created_at: string;
}

export function ChatWorkspace() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.thread_id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const fetchThreads = useCallback(async () => {
    const res = await fetch("/api/chat/threads", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Failed to load chat threads");
    }
    const loadedThreads = data?.threads || [];
    setThreads(loadedThreads);
    if (!activeThreadId && loadedThreads.length > 0) {
      setActiveThreadId(loadedThreads[0].thread_id);
    }
    return loadedThreads;
  }, [activeThreadId]);

  const createThread = useCallback(async () => {
    setCreatingThread(true);
    try {
      const threadId = crypto.randomUUID();
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          title: `Chat ${threads.length + 1}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create thread");
      }
      setThreads((prev) => [data.thread, ...prev]);
      setActiveThreadId(data.thread.thread_id);
      setMessages([]);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create chat thread");
    } finally {
      setCreatingThread(false);
    }
  }, [threads.length]);

  const fetchMessages = async (threadId: string) => {
    const res = await fetch(`/api/chat/threads/${threadId}/messages`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Failed to load messages");
    }
    setMessages(data?.messages || []);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const loaded = await fetchThreads();
        if (loaded.length === 0) {
          await createThread();
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to initialize chat");
      } finally {
        setLoading(false);
      }
    })();
  }, [createThread, fetchThreads]);

  useEffect(() => {
    if (!activeThreadId) return;
    (async () => {
      try {
        await fetchMessages(activeThreadId);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch messages");
      }
    })();
  }, [activeThreadId]);

  const sendMessage = async () => {
    if (!activeThreadId || !messageInput.trim()) return;
    setError(null);
    const content = messageInput.trim();
    setMessageInput("");

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sender: "user",
        message: content,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch(`/api/chat/threads/${activeThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send message");
      }
      setMessages(data?.messages || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-xl border border-border/60 bg-card/70 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Threads</h3>
          <Button size="sm" variant="outline" onClick={createThread} disabled={creatingThread}>
            New
          </Button>
        </div>
        <div className="space-y-2">
          {threads.map((thread) => (
            <button
              key={thread.thread_id}
              type="button"
              onClick={() => setActiveThreadId(thread.thread_id)}
              className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                activeThreadId === thread.thread_id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/40"
              }`}
            >
              {thread.title}
            </button>
          ))}
        </div>
      </aside>

      <section className="rounded-xl border border-border/60 bg-card/70 p-3">
        <div className="mb-3 border-b border-border/60 pb-2">
          <h3 className="text-sm font-semibold">{activeThread?.title || "Chat"}</h3>
          <p className="text-xs text-muted-foreground">Ask for claim explanations, payout reasoning, and next actions.</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTitle>Chat error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="h-[420px] rounded-md border border-border/50 bg-background/40 p-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading chat workspace...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={msg.sender === "assistant" ? "" : "flex justify-end"}>
                  {msg.sender === "assistant" ? (
                    <div className="max-w-[85%]">
                      <MarkdownMessage content={msg.message} isUser={false} />
                    </div>
                  ) : (
                    <div className="max-w-[85%]">
                      <MarkdownMessage content={msg.message} isUser={true} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="mt-3 flex gap-2">
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Type your question..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <Button onClick={sendMessage} disabled={!activeThreadId || !messageInput.trim()}>
            Send
          </Button>
        </div>
      </section>
    </div>
  );
}
