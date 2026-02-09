# WebForge AI - Quick Start Guide

Get WebForge AI running in 5 minutes! 🚀

## Step 1: Prerequisites

Make sure you have:
- ✅ Node.js 18 or higher installed ([Download](https://nodejs.org/))
- ✅ An Anthropic API key ([Get one](https://console.anthropic.com/))

## Step 2: Installation

1. **Extract the project** (or clone from Git)
   ```bash
   cd webforge-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   This will take 1-2 minutes. ☕

## Step 3: Configuration

1. **Copy the environment file**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and add your API key**
   ```
   ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
   ```

## Step 4: Run the App

```bash
npm run dev
```

You should see:
```
▲ Next.js 14.2.16
- Local:        http://localhost:3000
```

## Step 5: Generate Your First Website!

1. **Open your browser**: Go to `http://localhost:3000`

2. **Enter a prompt**, for example:
   ```
   Create a modern portfolio website for a photographer 
   with a gallery, about section, and contact form
   ```

3. **Click "Generate Website"**

4. **Wait 30-60 seconds** for the AI to:
   - Analyze your intent
   - Design the color scheme and layout
   - Generate HTML/CSS/JavaScript
   - Evaluate code quality

5. **Preview and download** your website!

## Example Prompts to Try

```
1. Build a landing page for a SaaS product with pricing tiers

2. Create a blog website with dark mode and article categories

3. Design an e-commerce product page for handmade jewelry

4. Generate a documentation site with sidebar navigation

5. Make a personal resume website with work experience timeline
```

## Optional: Upload Documents

For better content accuracy:

1. Click "Upload Documents"
2. Drag & drop or select PDF, DOCX, or TXT files
3. Files will be processed and used to populate website content
4. Great for company info, product descriptions, bios, etc.

## Troubleshooting

### "API key not configured" error
- Check that your `.env` file has `ANTHROPIC_API_KEY=sk-ant-...`
- Restart the dev server after changing `.env`

### "Failed to generate website"
- Verify your API key is valid
- Check your internet connection
- Look at the browser console for error details

### Port 3000 already in use
```bash
npm run dev -- -p 3001
```
Then visit `http://localhost:3001`

### Upload not working
- Make sure file is PDF, DOCX, or TXT
- File must be under 10MB
- Check that `/public/uploads` folder exists

## What's Next?

- ⭐ Star the project on GitHub
- 📖 Read the full README.md
- 🛠️ Customize the code generation prompts
- 🎨 Modify the UI components
- 🚀 Deploy to Vercel or Netlify

## Need Help?

- Check the full documentation in README.md
- Open an issue on GitHub
- Review the code comments

---

Happy building! 🎉
