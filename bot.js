import fs from 'fs';
import googleTrends from 'google-trends-api';
import { GoogleGenAI } from '@google/genai';

// Wake up the Gemini Brain
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const targetWriter = "Neil Patel"; 

// The name of our Memory Notebook
const MEMORY_FILE = 'history.json';

async function generateBlogPost() {
  try {
    console.log("Robot waking up! Checking Memory Notebook...");
    
    // 1. Open the Memory Notebook to see what we already wrote about
    let memory = [];
    if (fs.existsSync(MEMORY_FILE)) {
        const rawData = fs.readFileSync(MEMORY_FILE);
        memory = JSON.parse(rawData);
    }
    
    // 2. Fetch the top 20 trending topics
    const trends = await googleTrends.dailyTrends({ geo: 'US' });
    const parsedTrends = JSON.parse(trends);
    const searches = parsedTrends.default.trendingSearchesDays[0].trendingSearches;
    
    // 3. Look for a fresh topic we haven't written about yet
    let topic = null;
    for (const search of searches) {
        const potentialTopic = search.title.query;
        if (!memory.includes(potentialTopic)) {
            topic = potentialTopic;
            break; 
        }
    }

    // If we have written about everything on the list, go back to sleep
    if (!topic) {
        console.log("No fresh topics right now. I will check again next hour!");
        return; 
    }

    console.log(`Fresh Topic Found: ${topic}`);

    // 4. The Copywriter Prompt
    const prompt = `
    You are an elite ghostwriter tasked with writing an SEO-optimized blog post about "${topic}".
    Your most important directive is to flawlessly imitate the exact writing style, tone, and pacing of ${targetWriter}.

    1. **The Hook:** Start exactly how ${targetWriter} would start. Mimic their signature pattern interrupt or curiosity gap.
    2. **Voice & Tone:** Match the vocabulary and sentence length of ${targetWriter}.
    3. **Body & SEO:** Use skimmable short paragraphs, bullet points, and relatable analogies. Naturally weave in semantic LSI keywords and H2/H3 subheadings.
    4. **Outro:** End the article with a powerful, defining takeaway in the exact manner ${targetWriter} concludes their pieces.
    5. **Call to Action (CTA):** Deliver a clear, compelling CTA encouraging readers to share the post.

    Output strictly in Markdown format. Do not include a main H1 title at the very top. Do not break character or mention that you are an AI.
    `;

    // 5. Generate the Article
    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
    });
    const articleContent = response.text;

    // 6. Generate the Image
    const safeTopic = topic.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const imageResponse = await ai.models.generateImages({
        model: 'imagen-3.0-generate-001',
        prompt: `A high-quality, editorial illustration representing ${topic}, minimalist, vibrant, no text`,
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
    });
    
    // 7. Save the Image
    const imgBuffer = Buffer.from(imageResponse.generatedImages[0].image.imageBytes, 'base64');
    const timeStamp = Date.now();
    const imgFilename = `${safeTopic}-${timeStamp}.jpg`;
    
    if (!fs.existsSync('public/images')) {
        fs.mkdirSync('public/images', { recursive: true });
    }
    fs.writeFileSync(`public/images/${imgFilename}`, imgBuffer);

    // 8. Save the Blog Post
    const dateStr = new Date().toISOString().split('T')[0];
    const filepath = `src/content/blog/${dateStr}-${timeStamp}.md`;
    
    const frontmatter = `---
title: "${topic}"
description: "An SEO optimized post about ${topic}"
pubDate: '${new Date().toISOString()}'
heroImage: "/images/${imgFilename}"
---

`;
    fs.writeFileSync(filepath, frontmatter + articleContent);
    console.log(`Successfully created: ${filepath}`);

    // 9. Write the new topic down in the Memory Notebook!
    memory.push(topic);
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
    console.log("Memory Notebook updated!");

  } catch (error) {
    console.error("Robot hit an error:", error);
  }
}

generateBlogPost();