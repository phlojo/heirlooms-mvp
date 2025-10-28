import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST() {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || "heirlooms/collections";

  const paramsToSign = new URLSearchParams({ timestamp: String(timestamp), folder });
  const toSign = [...paramsToSign.entries()].map(([k,v]) => `${k}=${v}`).sort().join("&");

  const signature = crypto
    .createHash("sha1")
    .update(toSign + process.env.CLOUDINARY_API_SECRET)
    .digest("hex");

  return NextResponse.json({
    timestamp,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    signature,
  });
}