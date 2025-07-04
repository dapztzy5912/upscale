import express from 'express';
import fileUpload from 'express-fileupload';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import { promises as fs } from 'fs';
import upslace from './upscale.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 },
}));

app.get('/', (req, res) => {
    res.render('index', { originalImage: null, enhancedImage: null, error: null });
});

const MAX_RETRIES = 3; // Jumlah percobaan ulang
const RETRY_DELAY = 5000; // Waktu tunda antara percobaan (ms)

async function upscaleWithRetry(imageBuffer, retries = 0) {
    try {
        return await upslace(imageBuffer);
    } catch (error) {
        console.error(`Upscale failed (attempt ${retries + 1}):`, error);
        if (retries < MAX_RETRIES && error.response && error.response.status === 500) {
            console.log(`Retrying in ${RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return upscaleWithRetry(imageBuffer, retries + 1);
        }
        throw error; // Jika semua percobaan gagal, lemparkan error
    }
}

app.post('/upscale', async (req, res) => {
    try {
        if (!req.files || !req.files.image) {
            return res.status(400).json({ error: 'No image uploaded.' });
        }

        const imageFile = req.files.image;
        const originalImageBuffer = imageFile.data;

        const enhancedImageBuffer = await upscaleWithRetry(originalImageBuffer);
        const enhancedImageBase64 = `data:image/png;base64,${enhancedImageBuffer.toString('base64')}`;

        return res.json({ enhancedImage: enhancedImageBase64 });

    } catch (error) {
        console.error("Final upscale error:", error);
        let errorMessage = 'Error processing image.';
        if (error.response && error.response.status === 500) {
            errorMessage = 'Upscaling service is currently unavailable. Please try again later.';
        }
        return res.status(500).json({ error: errorMessage });
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
