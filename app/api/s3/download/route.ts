import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.AWS_S3_BUCKET!;
const PREFIX = process.env.AWS_S3_PREFIX || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename");
  if (!filename) {
    return NextResponse.json({ message: "Missing filename" }, { status: 400 });
  }
  try {
    // For files inside the fossil folder, we need to construct the full path
    // The filename from the frontend will be just the filename without the prefix
    const key = `${PREFIX}/${filename}`;
    
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    const data = await s3.send(command);
    const stream = data.Body as ReadableStream;
    
    // Use the original filename for the Content-Disposition header
    // It's already just the filename without the path since we're displaying files that way
    
    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": data.ContentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || "Failed to download file" },
      { status: 500 }
    );
  }
}
