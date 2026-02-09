# WebForge AI - Intelligent Website Generator

An intelligent framework for automated SDLC that transforms natural language prompts into production-ready websites using AI-powered intent classification, RAG (Retrieval-Augmented Generation), and explainable quality assurance.

## 🌟 Features

- **Intent Classification**: ML-powered analysis to understand user requirements and design preferences
- **RAG Integration**: Ground website content in uploaded documents (PDF, DOCX, TXT)
- **Design Intelligence**: AI-driven design system recommendations with color palettes and typography
- **Code Generation**: Production-ready HTML, CSS, and JavaScript using Claude AI
- **Quality Assurance**: Explainable AI evaluation of code quality, accessibility, and best practices
- **Real-time Preview**: Live preview of generated websites
- **One-Click Download**: Export complete HTML files

## 🏗️ Architecture

```
User Prompt + Documents
         ↓
1. Intent Classification (Claude AI)
         ↓
2. Design Recommendations (Claude AI)
         ↓
3. RAG Pipeline (Document Processing)
         ↓
4. Code Generation (Claude AI)
         ↓
5. Quality Evaluation (Claude AI)
         ↓
Preview + Download
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Anthropic API Key ([Get one here](https://console.anthropic.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/webforge-ai.git
   cd webforge-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Add your Anthropic API key to `.env`**
   ```
   ANTHROPIC_API_KEY=your_actual_api_key_here
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage

### Basic Website Generation

1. **Enter your prompt**
   - Describe the website you want to create
   - Example: "Create a modern portfolio website for a photographer with a gallery and contact form"

2. **Upload documents (optional)**
   - Upload PDF, DOCX, or TXT files
   - Content will be used to populate the website

3. **Click "Generate Website"**
   - Wait for the AI to analyze, design, and generate code
   - View the progress in real-time

4. **Review and download**
   - Preview the generated website
   - Check the quality score
   - Download the HTML file

### Advanced Features

#### Custom Design Preferences
```javascript
// In API call
{
  "prompt": "Create a blog website",
  "designPreferences": {
    "colorPalette": {
      "primary": "#3b82f6",
      "secondary": "#8b5cf6"
    },
    "typography": {
      "headingFont": "Playfair Display",
      "bodyFont": "Inter"
    }
  }
}
```

#### Document-Grounded Content
Upload company documents, product descriptions, or content files to automatically populate your website with relevant, accurate information.

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **AI/LLM**: Anthropic Claude (Sonnet 4)
- **Document Processing**: pdf-parse, mammoth
- **File Upload**: react-dropzone
- **Code Preview**: iframe sandbox

## 📁 Project Structure

```
webforge-ai/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/      # Website generation endpoint
│   │   │   └── upload/        # File upload endpoint
│   │   ├── page.tsx           # Main application page
│   │   └── layout.tsx         # Root layout
│   ├── components/
│   │   ├── PromptInput.tsx    # Prompt input component
│   │   ├── FileUpload.tsx     # Document upload component
│   │   ├── CodePreview.tsx    # Live preview component
│   │   ├── QualityReport.tsx  # Quality score display
│   │   └── GenerationProgress.tsx
│   ├── services/
│   │   ├── claude.service.ts              # Claude API wrapper
│   │   ├── intentClassification.service.ts
│   │   ├── designRecommendation.service.ts
│   │   ├── documentProcessing.service.ts
│   │   ├── codeGeneration.service.ts
│   │   ├── qualityScoring.service.ts
│   │   └── webforge.service.ts           # Main orchestrator
│   └── types/
│       └── index.ts           # TypeScript type definitions
├── public/
│   └── uploads/               # Uploaded documents storage
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 🔑 Key Components

### Intent Classification
Analyzes user prompts to identify:
- Website type (portfolio, landing page, blog, e-commerce, etc.)
- Design style (modern, minimal, corporate, creative)
- Required components (hero, gallery, contact form, etc.)
- User requirements

### RAG Pipeline
1. Processes uploaded documents (PDF, DOCX, TXT)
2. Extracts and chunks text content
3. Uses document content to inform code generation
4. Ensures accuracy and relevance

### Code Generation
- Generates complete HTML, CSS, and JavaScript
- Follows web standards and best practices
- Responsive, mobile-first design
- Accessibility-compliant (WCAG 2.1)
- Clean, commented code

### Quality Scoring
Evaluates generated code across:
- **Code Quality**: Structure, maintainability
- **Design Consistency**: Visual harmony, spacing
- **Accessibility**: WCAG compliance, semantic HTML
- **Performance**: Optimization, loading speed
- **Responsiveness**: Mobile-first, breakpoints

## 🎯 Example Prompts

```
1. "Create a modern landing page for a SaaS product with pricing tiers, 
    testimonials, and a contact form"

2. "Build a portfolio website for a graphic designer with a dark theme, 
    project gallery, and about section"

3. "Design a blog website with categories, search functionality, and 
    newsletter signup"

4. "Generate an e-commerce product page for handmade jewelry with 
    product images, descriptions, and add to cart"

5. "Create a documentation site with sidebar navigation, code snippets, 
    and search"
```

## 🧪 API Endpoints

### POST /api/generate
Generate a website from a prompt and optional documents.

**Request:**
```json
{
  "prompt": "Create a portfolio website",
  "documents": [
    {
      "id": "doc-123",
      "name": "resume.pdf",
      "type": "pdf"
    }
  ],
  "designPreferences": {
    "colorPalette": { ... }
  }
}
```

**Response:**
```json
{
  "success": true,
  "intent": { ... },
  "design": { ... },
  "code": {
    "html": "...",
    "css": "...",
    "javascript": "..."
  },
  "quality": {
    "overall": 85,
    "breakdown": { ... }
  }
}
```

### POST /api/upload
Upload documents for RAG integration.

**Request:** `multipart/form-data` with files

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "id": "doc-123",
      "name": "document.pdf",
      "size": 102400,
      "wordCount": 1500
    }
  ]
}
```

## 🔒 Security

- File upload size limited to 10MB
- Allowed file types: PDF, DOCX, TXT
- Iframe sandbox for preview isolation
- Environment variables for API keys
- No client-side API key exposure

## 🚧 Roadmap

- [ ] Vector database integration (Pinecone/ChromaDB)
- [ ] User authentication and project saving
- [ ] Multi-page website generation
- [ ] React component export
- [ ] Custom template library
- [ ] Collaborative editing
- [ ] A/B testing variants
- [ ] Deployment to hosting platforms

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Team

Presented by:
- Aaditya Joshi
- Shreeyash Pawar
- Manas Kadam
- Ayush Deshmukh

Institution: Department of Electrical and Electronics Engineering, MIT-WPU

## 🙏 Acknowledgments

- Built with [Claude AI](https://www.anthropic.com/claude) by Anthropic
- Powered by [Next.js](https://nextjs.org/)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)

## 📧 Support

For questions or support, please open an issue on GitHub or contact the development team.

---

**WebForge AI** - Revolutionizing web development through intelligent automation 🚀
