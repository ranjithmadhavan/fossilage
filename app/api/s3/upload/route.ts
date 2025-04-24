import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.AWS_S3_BUCKET!;
const BASE_PREFIX = process.env.AWS_S3_PREFIX || "";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const currentPath = formData.get("currentPath") as string || "";
  const preservePath = formData.get("preservePath") as string || "false";
  const createFolder = formData.get("createFolder") as string || "false";
  const webkitRelativePath = formData.get("webkitRelativePath") as string || "";
  
  if (!file) {
    return NextResponse.json({ message: "Missing file" }, { status: 400 });
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Handle folder creation
    if (createFolder === "true") {
      // Create a folder marker by adding a trailing slash
      const folderKey = currentPath.endsWith("/") ? currentPath : `${currentPath}/`;
      
      // Construct the full S3 key for the folder
      const key = BASE_PREFIX ? 
        `${BASE_PREFIX}/${folderKey}` : 
        folderKey;
      
      // Create an empty object with a trailing slash to represent a folder
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: Buffer.from(""),
        ContentType: "application/x-directory",
      }));
      
      return NextResponse.json({ success: true });
    }
    
    // Handle file path based on whether we need to preserve folder structure
    let filePath = file.name;
    
    if (preservePath === "true") {
      // For folder uploads, use the relative path from the input if available
      if (webkitRelativePath) {
        filePath = webkitRelativePath;
      } else if ((file as any).webkitRelativePath) {
        filePath = (file as any).webkitRelativePath;
      }
    }
    
    // Construct the full S3 key
    let key;
    if (currentPath) {
      key = BASE_PREFIX ? 
        `${BASE_PREFIX}/${currentPath}/${filePath}` : 
        `${currentPath}/${filePath}`;
    } else {
      key = BASE_PREFIX ? 
        `${BASE_PREFIX}/${filePath}` : 
        filePath;
    }
    
    // Normalize the key to handle any double slashes
    key = key.replace(/\/+/g, "/");
    
    // If we're uploading a file to a folder, ensure the folder exists
    if (key.includes("/")) {
      const folderPath = key.substring(0, key.lastIndexOf("/") + 1);
      
      // Create the folder marker
      try {
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: folderPath,
          Body: Buffer.from(""),
          ContentType: "application/x-directory",
        }));
      } catch (folderErr) {
        // Ignore errors when creating folder markers
        console.error("Error creating folder marker:", folderErr);
      }
    }
    
    // Upload the actual file
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: Buffer.from(arrayBuffer),
      ContentType: file.type || "application/octet-stream",
    }));
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
