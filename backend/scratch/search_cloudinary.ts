import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function run() {
  console.log("Listing Cloudinary resources...");
  try {
    const result = await cloudinary.api.resources({
      resource_type: "video",
      type: "upload",
      max_results: 30
    });
    console.log("Upload type resources:", result.resources.map((r: any) => ({
      public_id: r.public_id,
      format: r.format,
      type: r.type,
      url: r.secure_url
    })));
  } catch (error: any) {
    console.error("❌ Failed to list public video resources:", error.message);
  }

  try {
    const resultAuth = await cloudinary.api.resources({
      resource_type: "video",
      type: "authenticated",
      max_results: 30
    });
    console.log("Authenticated type resources:", resultAuth.resources.map((r: any) => ({
      public_id: r.public_id,
      format: r.format,
      type: r.type,
      url: r.secure_url
    })));
  } catch (error: any) {
    console.error("❌ Failed to list authenticated video resources:", error.message);
  }
}

run();
