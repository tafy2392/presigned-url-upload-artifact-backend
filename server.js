// --- Dependencies ---
// Load environment variables from a .env file for local development
require('dotenv').config();

const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const cors = require('cors');
const crypto = require('crypto');

// --- Application Setup ---
const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
// 1. CORS (Cross-Origin Resource Sharing)
// Allows requests from any origin. For production, you might want to restrict this
// to your specific frontend domain for better security.
app.use(cors());

// 2. JSON Body Parser
// Enables the server to understand and process JSON-formatted request bodies.
app.use(express.json());

// 3. API Key Authentication Middleware
// This function acts as a gatekeeper for our protected routes.
const requireApiKey = (req, res, next) => {
    const apiKey = req.get('x-api-key'); // Standard header for API keys

    // Check if the API_KEY is configured on the server
    if (!process.env.API_KEY) {
        console.error("CRITICAL SECURITY ALERT: API_KEY is not configured on the server.");
        // We send a generic error to avoid leaking implementation details.
        return res.status(500).json({ error: "Internal Server Configuration Error" });
    }

    // Check if the client provided a key and if it matches the server's key
    if (!apiKey || apiKey !== process.env.API_KEY) {
        console.warn(`Failed API key attempt from IP: ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // If the key is valid, allow the request to proceed to the main route handler
    next();
};

// --- AWS S3 Client Configuration ---
// The S3 client is configured using credentials and region from environment variables.
// This is the secure way to handle credentials in a containerized environment.
const s3Client = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// --- API Routes ---
// Health check endpoint to verify the server is running
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

// The main endpoint to generate a pre-signed URL for file uploads
// The `requireApiKey` middleware is applied here to protect the route.
app.post('/get-presigned-url', requireApiKey, async (req, res) => {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
        return res.status(400).json({ error: 'filename and contentType are required.' });
    }

    try {
        // Generate a unique, secure filename to prevent object key collisions in S3
        const randomBytes = crypto.randomBytes(16).toString('hex');
        const key = `uploads/${randomBytes}-${filename}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        // Generate the pre-signed URL. It will be valid for 5 minutes (300 seconds).
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        console.log(`Successfully generated pre-signed URL for: ${key}`);

        // Send the URL and the final key back to the frontend
        res.status(200).json({
            uploadUrl,
            key // The frontend may need this key to confirm the upload
        });

    } catch (error) {
        console.error('Error creating pre-signed URL:', error);
        res.status(500).json({ error: 'Internal server error while creating pre-signed URL.' });
    }
});

// --- Server Initialization ---
// The server listens on 0.0.0.0 to accept connections from any network interface,
// which is essential for running inside a Docker container.
app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server listening on port ${port}`);
});
