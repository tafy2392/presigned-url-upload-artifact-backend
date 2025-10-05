// Load environment variables from a .env file for security
require('dotenv').config();

const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
// Enable CORS for all origins.
// WARNING: For production, you should restrict this to your frontend's specific domain.
app.use(cors());

// Enable the server to parse JSON request bodies
app.use(express.json());

// --- AWS S3 Client Configuration ---
const s3Client = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// --- API Endpoint to Generate Pre-signed URL ---
app.post('/get-presigned-url', async (req, res) => {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
        return res.status(400).json({ error: 'filename and contentType are required.' });
    }

    try {
        const randomBytes = crypto.randomBytes(16).toString('hex');
        const key = `uploads/${randomBytes}-${filename}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

        console.log(`Generated pre-signed URL for: ${key}`);

        res.json({
            uploadUrl,
            key
        });

    } catch (error) {
        console.error('Error creating pre-signed URL:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server listening on port ${port}`);
});
