"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MarkdownMessage } from "@/components/MarkdownMessage";

interface ChatThread {
  thread_id: string;
  title: string;
  claim_id?: string | null;
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
  const [editingTitle, setEditingTitle] = useState("");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimIdInput, setClaimIdInput] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [availableClaims, setAvailableClaims] = useState<Array<{ claim_id: string; description: string }>>([]);
  const [showClaimDropdown, setShowClaimDropdown] = useState(false);
  const [claimsLoadingList, setClaimsLoadingList] = useState(false);

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

  const createThread = useCallback(async (claimId?: string) => {
    setCreatingThread(true);
    try {
      const threadId = crypto.randomUUID();
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          title: claimId ? `Chat - ${claimId}` : `Chat ${threads.length + 1}`,
          claimId: claimId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create thread");
      }
      const newThread = data.thread;
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(newThread.thread_id);
      setMessages([]);
      setError(null);
      setClaimModalOpen(false);
      setClaimIdInput("");
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

  const updateThreadTitle = async (threadId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch("/api/chat/threads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, title: newTitle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update title");
      }
      setThreads((prev) =>
        prev.map((t) => (t.thread_id === threadId ? { ...t, title: newTitle.trim() } : t))
      );
      setEditingTitle("");
      setEditingThreadId(null);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update title");
    }
  };

  const handleAddClaimId = async () => {
    if (!claimIdInput.trim()) {
      setError("Claim ID is required");
      return;
    }
    setClaimLoading(true);
    setError(null);
    try {
      await createThread(claimIdInput.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create thread with claim");
    } finally {
      setClaimLoading(false);
    }
  };

  const fetchAvailableClaims = useCallback(async () => {
    setClaimsLoadingList(true);
    try {
      const res = await fetch("/api/claims?perPage=100", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        const claimsList = (data?.data || [])
          .map((claim: Record<string, unknown>) => ({
            claim_id: String(claim.claim_id || ""),
            description: String(claim.description || "").substring(0, 50),
          }))
          .filter((c: { claim_id: string }) => c.claim_id);
        setAvailableClaims(claimsList);
      }
    } catch (err) {
      console.error("Failed to fetch available claims:", err);
    } finally {
      setClaimsLoadingList(false);
    }
  }, []);

  const filteredClaims = availableClaims.filter((claim) =>
    claim.claim_id.toLowerCase().includes(claimIdInput.toLowerCase())
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const loaded = await fetchThreads();
        if (loaded.length === 0) {
          setClaimModalOpen(true);
          await fetchAvailableClaims();
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to initialize chat");
      } finally {
        setLoading(false);
      }
    })();
  }, [createThread, fetchThreads, fetchAvailableClaims]);

  useEffect(() => {
    if (!activeThreadId) return;
    (async () => {
      try {
        await fetchMessages(activeThreadId);
        // Load claim data if thread has claim_id
        const thread = threads.find(t => t.thread_id === activeThreadId);
        if (thread?.claim_id) {
          // Could fetch claim data here if needed
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to fetch messages");
      }
    })();
  }, [activeThreadId, threads]);

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
      {/* Claim ID Modal */}
      <Dialog open={claimModalOpen} onOpenChange={(open) => {
        setClaimModalOpen(open);
        if (open && availableClaims.length === 0) {
          fetchAvailableClaims();
        }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Start Chat with Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select or Search Claim</label>
              <div className="relative">
                <Input
                  placeholder={claimsLoadingList ? "Loading claims..." : "Search or type claim ID..."}
                  value={claimIdInput}
                  onChange={(e) => {
                    setClaimIdInput(e.target.value);
                    setShowClaimDropdown(true);
                  }}
                  onFocus={() => {
                    setShowClaimDropdown(true);
                    if (availableClaims.length === 0) {
                      fetchAvailableClaims();
                    }
                  }}
                  disabled={claimsLoadingList}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (filteredClaims.length === 1) {
                        setClaimIdInput(filteredClaims[0].claim_id);
                        setShowClaimDropdown(false);
                      } else {
                        handleAddClaimId();
                      }
                    } else if (e.key === "Escape") {
                      setShowClaimDropdown(false);
                    }
                  }}
                />
                {showClaimDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto border border-border/60 rounded-md bg-background/95 shadow-md z-50">
                    {claimsLoadingList ? (
                      <div className="p-3 text-xs text-muted-foreground">Loading claims...</div>
                    ) : filteredClaims.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">
                        {claimIdInput ? "No matching claims" : "No claims available"}
                      </div>
                    ) : (
                      filteredClaims.map((claim) => (
                        <button
                          key={claim.claim_id}
                          type="button"
                          onClick={() => {
                            setClaimIdInput(claim.claim_id);
                            setShowClaimDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-primary/10 transition text-xs border-b border-border/30 last:border-b-0"
                        >
                          <div className="font-medium">{claim.claim_id}</div>
                          <div className="text-xs text-muted-foreground truncate">{claim.description}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Select an existing claim or enter a claim ID.</p>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setClaimModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClaimId} disabled={claimLoading || !claimIdInput.trim()}>
              {claimLoading ? "Creating..." : "Create Chat"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Threads Sidebar */}
      <aside className="rounded-xl border border-border/60 bg-card/70 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Threads</h3>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => {
              setClaimModalOpen(true);
              setClaimIdInput("");
              setError(null);
              setShowClaimDropdown(false);
              if (availableClaims.length === 0) {
                fetchAvailableClaims();
              }
            }} 
            disabled={creatingThread}
          >
            New
          </Button>
        </div>
        <div className="space-y-2">
          {threads.map((thread) => (
            <div
              key={thread.thread_id}
              className={`group rounded-md border px-3 py-2 transition ${
                activeThreadId === thread.thread_id
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-background/60 hover:border-primary/40"
              }`}
            >
              {editingThreadId === thread.thread_id ? (
                <div className="flex gap-2">
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    className="h-7 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        updateThreadTitle(thread.thread_id, editingTitle);
                      } else if (e.key === "Escape") {
                        setEditingTitle("");
                        setEditingThreadId(null);
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => updateThreadTitle(thread.thread_id, editingTitle)}
                  >
                    ✓
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveThreadId(thread.thread_id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${activeThreadId === thread.thread_id ? "text-foreground" : "text-muted-foreground"}`}>
                        {thread.title}
                      </p>
                      {thread.claim_id && (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {thread.claim_id}
                        </Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTitle(thread.title);
                        setEditingThreadId(thread.thread_id);
                      }}
                      className="ml-2 opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      ✏️
                    </button>
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Chat Section */}
      <section className="rounded-xl border border-border/60 bg-card/70 p-3">
        <div className="mb-3 border-b border-border/60 pb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">{activeThread?.title || "Chat"}</h3>
            {activeThread?.claim_id && (
              <Badge variant="outline" className="text-xs">
                {activeThread.claim_id}
              </Badge>
            )}
          </div>
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
            disabled={!activeThreadId || !messages || messages.length === 0 && activeThread?.claim_id === null}
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
