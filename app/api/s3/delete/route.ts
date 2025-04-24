import { NextRequest, NextResponse } from "next/server";
import { S3Client, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.AWS_S3_BUCKET!;
const BASE_PREFIX = process.env.AWS_S3_PREFIX || "";

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  const type = searchParams.get("type") || "file";
  
  if (!path) {
    return NextResponse.json({ message: "Missing path" }, { status: 400 });
  }
  
  try {
    // Construct the full path with the base prefix
    const fullPath = BASE_PREFIX ? 
      (path ? `${BASE_PREFIX}/${path}` : BASE_PREFIX) : 
      path;
    
    // If it's a file, delete it directly
    if (type === "file") {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: fullPath,
      });
      await s3.send(command);
      return NextResponse.json({ success: true });
    } 
    // If it's a folder, list all objects and delete them
    else if (type === "folder") {
      // Add trailing slash for folder prefix if not present
      const folderPrefix = fullPath.endsWith("/") ? fullPath : `${fullPath}/`;
      
      // List all objects in the folder
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: folderPrefix,
      });
      
      const listData = await s3.send(listCommand);
      const objects = listData.Contents || [];
      
      if (objects.length === 0) {
        return NextResponse.json({ message: "Folder is empty or does not exist" }, { status: 404 });
      }
      
      // Delete all objects in batches of 1000 (S3 limit)
      const objectsToDelete = objects.map(obj => ({ Key: obj.Key }));
      
      // S3 allows deleting up to 1000 objects in a single request
      const batchSize = 1000;
      for (let i = 0; i < objectsToDelete.length; i += batchSize) {
        const batch = objectsToDelete.slice(i, i + batchSize);
        
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: batch },
        });
        
        await s3.send(deleteCommand);
      }
      
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ message: "Invalid type" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || "Failed to delete" },
      { status: 500 }
    );
  }
}
