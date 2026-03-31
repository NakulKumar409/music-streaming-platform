# Cloudinary Webhook Configuration Guide

To ensure your backend asynchronously processes video HLS transcodes and updates the database media state from `PROCESSING` to `READY`, you need to set up a Notification Webhook in your Cloudinary Dashboard.

## Step 1: Get Your Render Deployment URL
First, you need to know the base URL of your live API backend on Render. 
Example: `https://your-music-api-backend.onrender.com`

Based on the routes we created, the precise endpoint that listens for Cloudinary callbacks is:
```text
https://<YOUR_RENDER_APP_NAME>.onrender.com/api/v1/media/webhook
```

## Step 2: Configure Cloudinary
1. Log in to your [Cloudinary Console](https://console.cloudinary.com).
2. Look for the **Settings** (gear icon) on the bottom left or top right of the dashboard.
3. Click on **Upload** in the left sidebar menu.
4. Scroll down until you find the **Notification URL** field (often under the 'Upload settings' or 'Advanced' section).
5. Paste your exact Render webhook URL:
   `https://<YOUR_RENDER_APP_NAME>.onrender.com/api/v1/media/webhook`
6. Click **Save** at the bottom of the page.

## Step 3: Update Environment Variables
In your Render Environment Variables dashboard, ensure you've set the variable so the SDK also passes this URL dynamically during video uploads:
```env
CLOUDINARY_WEBHOOK_URL=https://<YOUR_RENDER_APP_NAME>.onrender.com/api/v1/media/webhook
```

Once this is complete, anytime a video is uploaded and the `sp_auto` HLS transformation finishes, Cloudinary will hit your server with an `eager_ready` event, and the backend will mark the video as playable.
