import { NextRequest, NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.AWS_S3_BUCKET!;
const PREFIX = process.env.AWS_S3_PREFIX || "";

export async function GET() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: PREFIX,
    });
    const data = await s3.send(command);
    const files = (data.Contents || [])
      .map((obj) => obj.Key)
      // Filter out the prefix itself and only include files inside the folder
      .filter((k) => {
        // Skip the prefix itself or any directory entries
        if (!k || k === PREFIX || k === `${PREFIX}/` || k.endsWith('/')) {
          return false;
        }

        // Only include files that are directly inside the PREFIX folder
        // This means they should have exactly one '/' after the PREFIX
        if (PREFIX) {
          const relativePath = k.startsWith(`${PREFIX}/`) ? k.substring(`${PREFIX}/`.length) : k;
          return !relativePath.includes('/');
        }

        return true;
      })
      // Remove the prefix from the filenames for display
      .map(key => {
        // Skip undefined keys (shouldn't happen, but TypeScript needs this check)
        if (!key) return "";

        // If the key has the prefix, remove it for display
        if (PREFIX && key.startsWith(`${PREFIX}/`)) {
          return key.substring(`${PREFIX}/`.length);
        }
        return key;
      })
      // Filter out any empty strings that might have been created
      .filter(filename => filename !== "");
    return NextResponse.json({ files });
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || "Failed to list files" },
      { status: 500 }
    );
  }
}
