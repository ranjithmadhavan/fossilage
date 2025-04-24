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
const BASE_PREFIX = process.env.AWS_S3_PREFIX || "";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const folderPath = searchParams.get("folderPath") || "";

    // Combine the base prefix with the folder path
    const fullPrefix = BASE_PREFIX ?
      (folderPath ? `${BASE_PREFIX}/${folderPath}/` : `${BASE_PREFIX}/`) :
      (folderPath ? `${folderPath}/` : "");

    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: fullPrefix,
      Delimiter: "/",
    });

    const data = await s3.send(command);

    // Process folders (CommonPrefixes)
    const folders = (data.CommonPrefixes || []).map(prefix => {
      const fullPath = prefix.Prefix || "";
      // Extract just the folder name from the full path
      const folderName = fullPath.split('/').filter(Boolean).pop() || "";
      
      // Create a clean path without trailing slash for consistent navigation
      let cleanPath = fullPath.startsWith(BASE_PREFIX + "/") ? 
        fullPath.substring((BASE_PREFIX + "/").length) : 
        fullPath;
      
      // Remove trailing slash for consistent navigation
      if (cleanPath.endsWith('/')) {
        cleanPath = cleanPath.slice(0, -1);
      }
      
      return {
        name: folderName,
        fullPath: cleanPath,
        type: "folder"
      };
    });

    // Process files (Contents)
    const files = (data.Contents || [])
      .filter(item => {
        const key = item.Key || "";
        // Skip the current directory marker
        return key !== fullPrefix;
      })
      .map(item => {
        const key = item.Key || "";
        // Extract just the filename from the full path
        const fileName = key.split('/').filter(Boolean).pop() || "";
        return {
          name: fileName,
          fullPath: key.startsWith(BASE_PREFIX + "/") ?
            key.substring((BASE_PREFIX + "/").length) :
            key,
          size: item.Size,
          lastModified: item.LastModified?.toISOString(),
          type: "file"
        };
      });

    // Combine folders and files
    const items = [...folders, ...files];

    return NextResponse.json({
      items,
      currentPath: folderPath
    });
  } catch (err: any) {
    return NextResponse.json(
      { message: err.message || "Failed to list files" },
      { status: 500 }
    );
  }
}
