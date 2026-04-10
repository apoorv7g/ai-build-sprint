"use client";

import React from "react";

interface KeyStatus {
  slot: number;
  active: boolean;
}

interface GroqKeyStatusBarProps {
  keyStatuses?: KeyStatus[];
}

export function GroqKeyStatusBar({ keyStatuses }: GroqKeyStatusBarProps) {
  // Default to showing all 3 keys as active (actual status is server-side)
  const defaults: KeyStatus[] = [
    { slot: 1, active: true },
    { slot: 2, active: true },
    { slot: 3, active: true },
  ];

  const statuses = keyStatuses || defaults;

  return (
    <div className="border border-white/20 bg-white/10 px-2.5 py-1.5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[11px] sm:text-xs flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-2 py-1 border bg-blue-200/25 border-blue-200/40 text-blue-50 rounded-sm">
          <span className="inline-block w-1.5 h-1.5 bg-blue-300" />
          <span className="font-medium">Model:</span>
          <span className="text-blue-100 font-mono">gpt-oss-120b</span>
        </div>
      {statuses.map((key) => (
        <div
          key={key.slot}
          className={`inline-flex items-center gap-1.5 px-2 py-1 border rounded-sm ${
            key.active
              ? "bg-emerald-200/25 border-emerald-200/40 text-emerald-50"
              : "bg-slate-400/10 border-slate-300/20 text-slate-200"
          }`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 ${
              key.active ? "bg-emerald-300" : "bg-slate-400"
            }`}
          />
          <span className="font-medium">
            Key #{key.slot}
          </span>
          <span className={key.active ? "text-emerald-100" : "text-slate-300"}>
            {key.active ? "Active" : "Inactive"}
          </span>
        </div>
      ))}
      </div>
    </div>
  );
}
