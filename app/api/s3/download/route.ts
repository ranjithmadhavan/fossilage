import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import JSZip from "jszip";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.AWS_S3_BUCKET!;
const BASE_PREFIX = process.env.AWS_S3_PREFIX || "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") || "";
  const type = searchParams.get("type") || "file";
  
  if (!path && type === "file") {
    return NextResponse.json({ message: "Missing path" }, { status: 400 });
  }
  
  try {
    // Construct the full path with the base prefix
    const fullPath = BASE_PREFIX ? 
      (path ? `${BASE_PREFIX}/${path}` : BASE_PREFIX) : 
      path;
    
    // If it's a file download, use the existing logic
    if (type === "file") {
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: fullPath,
      });
      
      const data = await s3.send(command);
      const stream = data.Body as ReadableStream;
      
      // Extract the filename from the path
      const filename = path.split("/").pop() || "file";
      
      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": data.ContentType || "application/octet-stream",
          "Content-Disposition": `attachment; filename=\"${filename}\"`,
        },
      });
    } 
    // If it's a folder download, create a zip file
    else if (type === "folder") {
      // List all objects in the folder
      const folderPrefix = fullPath.endsWith("/") ? fullPath : `${fullPath}/`;
      
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: folderPrefix,
      });
      
      const listData = await s3.send(listCommand);
      const objects = listData.Contents || [];
      
      if (objects.length === 0) {
        return NextResponse.json({ message: "Folder is empty" }, { status: 404 });
      }
      
      // Create a zip file
      const zip = new JSZip();
      
      // Download each file and add it to the zip
      for (const object of objects) {
        if (!object.Key || object.Key === folderPrefix) continue;
        
        const getCommand = new GetObjectCommand({
          Bucket: BUCKET,
          Key: object.Key,
        });
        
        const objectData = await s3.send(getCommand);
        const arrayBuffer = await objectData.Body?.transformToByteArray();
        
        if (arrayBuffer) {
          // Get the relative path within the folder
          const relativePath = object.Key.substring(folderPrefix.length);
          zip.file(relativePath, arrayBuffer);
        }
      }
      
      // Generate the zip file
      const zipContent = await zip.generateAsync({ type: "uint8array" });
      
      // Extract the folder name for the zip filename
      const folderName = path.split("/").pop() || "folder";
      
      return new NextResponse(zipContent, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename=\"${folderName}.zip\"`,
        },
      });
    } else {
      return NextResponse.json({ message: "Invalid type" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || "Failed to download" },
      { status: 500 }
    );
  }
}
