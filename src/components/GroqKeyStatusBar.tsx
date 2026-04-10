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
    <div className="flex items-center gap-3 text-xs">
      {statuses.map((key) => (
        <div key={key.slot} className="flex items-center gap-1">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              key.active ? "bg-green-400" : "bg-gray-400"
            }`}
          />
          <span className={key.active ? "text-green-300" : "text-gray-400"}>
            Key #{key.slot} {key.active ? "Active" : "Inactive"}
          </span>
        </div>
      ))}
    </div>
  );
}
