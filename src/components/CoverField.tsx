"use client";

import { useState } from "react";
import { CoverUpload } from "@/src/components/CoverUpload";

export function CoverField() {
  const [url, setUrl] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">Cover</label>
      <div className="flex items-center gap-3">
        <CoverUpload onUploaded={(u) => setUrl(u)} />
        {url && <span className="text-xs text-gray-500">Uploaded</span>}
      </div>
      <input type="hidden" name="coverUrl" value={url ?? ""} />
    </div>
  );
}
