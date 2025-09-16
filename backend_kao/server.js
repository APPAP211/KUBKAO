import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const PORT = 3000;
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- API Keys and Models ---
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const UNSPLASH_API_KEY = process.env.UNSPLASH_API_KEY; // <-- NEW
const GROQ_MODEL = 'llama-3.1-8b-instant';

// --- Function to clean up old images on startup (Optional but good practice) ---
const cleanupOldImages = () => {
    try {
        const publicDir = path.join(process.cwd(), 'public');
        if (fs.existsSync(publicDir)) {
            const files = fs.readdirSync(publicDir);
            const imageFiles = files.filter(file => path.extname(file).toLowerCase() === '.png' || path.extname(file).toLowerCase() === '.jpeg');
            if (imageFiles.length > 0) {
                imageFiles.forEach(file => {
                    try {
                        fs.unlinkSync(path.join(publicDir, file));
                    } catch (unlinkErr) {
                        console.error(`Error deleting file: ${file}`, unlinkErr);
                    }
                });
                console.log(`🧹 Cleaned up ${imageFiles.length} old generated image(s).`);
            } else {
                console.log("🧹 No old images to clean up.");
            }
        }
    } catch (err) {
        console.error("Error during initial image cleanup:", err);
    }
};

const checkApiKeys = () => {
    if (!GROQ_API_KEY) console.error("❌ ERROR: Groq API key not found.");
    if (!UNSPLASH_API_KEY) console.error("❌ ERROR: Unsplash API key not found."); // <-- NEW
    if (GROQ_API_KEY && UNSPLASH_API_KEY) console.log("✅ All API keys loaded successfully.");
};

function extractJSON(text) {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Could not find a JSON object in the AI's response.");
    }
    const jsonString = text.substring(jsonStart, jsonEnd + 1);
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error("--- FAILED TO PARSE JSON ---");
        console.error("Extracted String:", jsonString);
        throw new Error("AI returned malformed JSON.");
    }
}

app.post('/generate-menu', async (req, res) => {
    if (!GROQ_API_KEY || !UNSPLASH_API_KEY) { // <-- NEW
        return res.status(500).json({ error: 'Server is missing one or more API keys.' });
    }
    
    const { ingredients, style, method } = req.body;
    if (!ingredients || ingredients.length === 0) {
        return res.status(400).json({ error: 'Please provide at least one ingredient.' });
    }

    try {
        // --- Step 1: Get menu details from Groq ---
        console.log("1. Requesting menu details from Groq...");
        const groqPrompt = `
            You are a creative chef. Based on these details: ingredients "${ingredients.join(', ')}", style "${style}", method "${method}".
            Generate a menu item. Respond ONLY with a single, valid JSON object that adheres strictly to the JSON format specification. Do not use trailing commas.
            The structure must be exactly this:
            {
              "menuName": "The dish name in English",
              "description": "A short, enticing description in English",
              "recipe": { "ingredients": "...", "instructions": "..." }
            }
        `;
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'user', content: groqPrompt }], max_tokens: 1024 }),
        });
        if (!groqResponse.ok) throw new Error(`Groq API request failed with status ${groqResponse.status}`);
        
        const groqData = await groqResponse.json();
        const menuDetails = extractJSON(groqData.choices[0].message.content);
        console.log("2. Received menu details from Groq.");

        // --- Step 2: Search for an image using the Unsplash API ---
        const mainIngredient = ingredients[0] || 'food';
        const searchStyle = style !== 'any' ? style : '';
        const searchQuery = `food photography, ${mainIngredient}, ${searchStyle}, ${menuDetails.menuName}, plated dish`;
        
        console.log(`3. Searching Unsplash for: ${searchQuery}`);
        const unsplashResponse = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=landscape`, {
            headers: {
                'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
            }
        });
        
        // --- MODIFIED: Added detailed error logging ---
        if (!unsplashResponse.ok) {
            const errorText = await unsplashResponse.text(); // Get the exact error from Unsplash
            console.error("Unsplash API Error:", errorText); // Log it to the terminal
            throw new Error(`Unsplash API request failed with status ${unsplashResponse.status}.`);
        }

        const unsplashData = await unsplashResponse.json();
        let imageUrl = 'https://placehold.co/800x600/FFF8F7/FF6F61?text=Image+Not+Found'; // A default placeholder
        if (unsplashData.results && unsplashData.results.length > 0) {
            imageUrl = unsplashData.results[0].urls.regular; // Use the URL for a standard-sized image
        }
        console.log(`4. Found image URL: ${imageUrl}`);
        
        const finalResponse = {
            menuName: menuDetails.menuName,
            description: menuDetails.description,
            recipe: menuDetails.recipe,
            imageUrl: imageUrl,
        };
        
        console.log("5. Sending final response to browser.");
        res.json(finalResponse);

    } catch (error) {
        console.error('An error occurred in server.js:', error);
        res.status(500).json({ error: 'Failed to process your request. Please check server logs.' });
    }
});

app.listen(PORT, () => {
    cleanupOldImages();
    console.log(`🍳 Menu generator server is running on http://localhost:${PORT}`);
    checkApiKeys();
});

