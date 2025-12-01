# 🧠 Synapse Med

**AI-Powered Clinical Intelligence Hub** - Transform fragmented medical notes into verified Knowledge Graphs, Interactive Study Guides, and AI-Generated Podcasts using Google Gemini 2.5.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff.svg)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## 🎯 Overview

Synapse Med is an intelligent medical learning companion that leverages Google's Gemini 2.5 AI to transform lecture notes, PDFs, images, and audio files into comprehensive, board-exam-ready study materials. Built for medical students, residents, and healthcare professionals.

### ✨ Key Features

- 📚 **Multi-Format Input Support** - Upload PDFs, images, audio files, and text documents
- 🕸️ **Interactive Knowledge Graphs** - Visualize relationships between clinical concepts with D3.js
- 📝 **AI-Generated Study Guides** - Comprehensive markdown guides with 4,000-8,000 words
- 🎙️ **Neural Audio Podcasts** - AI-generated professor-student dialogues (Gemini TTS)
- 🔍 **Google Search Grounding** - Verified citations from authoritative medical sources
- 💡 **Clinical Pearls** - Gap-fillers, exam tips, red flags, and fact-checks
- 🎨 **ELI5 Analogies** - Complex concepts explained simply
- 👤 **Personalized Learning** - Customizable profiles for different disciplines and training levels
- 💾 **Local Storage Library** - Save and organize your generated notes

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Google Gemini API Key** ([Get one here](https://ai.google.dev/))

### Installation

```bash
# Clone the repository
git clone https://github.com/hareeshkar/synapse-med.git
cd synapse-med

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Add your Gemini API key to .env.local
echo "GEMINI_API_KEY=your_api_key_here" > .env.local

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`

---

## 🏗️ Architecture

### Two-Phase AI Processing

#### Phase 1: Knowledge Graph Construction
- Extracts metadata from uploaded materials
- Builds comprehensive knowledge graph (25-50 nodes)
- Generates clinical pearls and ELI5 analogies
- Performs Google Search verification for gap-filling

#### Phase 2: Content Generation
- Streams 4,000-8,000 word markdown study guides
- Integrates 25-35 authoritative citations
- Auto-links clinical terms to knowledge graph nodes
- Generates optional podcast scripts and neural audio

### Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React 19, TypeScript 5.8, Vite 6.2 |
| **Visualization** | D3.js (Force-directed graphs) |
| **AI/ML** | Google Gemini 2.5 (Flash & Pro), Google Search Grounding |
| **UI Components** | Lucide Icons, React Markdown |
| **Storage** | Browser LocalStorage |
| **Styling** | CSS Modules with custom clinical theme |

---

## 📖 Usage Guide

### 1️⃣ Upload Materials
- Drag and drop lecture PDFs, images, or audio files
- Enter a topic name (e.g., "Acute Coronary Syndrome")
- Click **"Generate Smart Guide"**

### 2️⃣ Real-Time Processing
Watch the AI work through:
- 🔍 **Extracting** - Analyzing uploaded content
- ✅ **Verifying** - Google Search validation
- 🕸️ **Graphing** - Building knowledge network
- ✍️ **Writing** - Streaming markdown content
- 📎 **Citing** - Adding authoritative sources

### 3️⃣ Interactive Study
- **Guide Tab** - Read the comprehensive study guide with clickable citations
- **Graph Tab** - Explore the 3D knowledge graph (click nodes for details)
- **ELI5 Mode** - Toggle simple analogies
- **Podcast** - Generate and listen to AI-hosted discussions

### 4️⃣ Library Management
- Access all generated notes from the Library tab
- Search, filter, and organize study materials
- Delete outdated notes

---

## 🎨 Knowledge Graph Features

The interactive knowledge graph visualizes clinical relationships with:

- **7 Node Categories**
  - Core Concepts (blue)
  - Pathology (red)
  - Medications (green)
  - Anatomy (purple)
  - Physiology (yellow)
  - Diagnostics (teal)
  - Clinical Signs (orange)

- **Interactive Controls**
  - Zoom in/out
  - Filter by category
  - Search nodes
  - Toggle labels
  - Focus on selected nodes
  - Drag to reposition

- **Node Details**
  - Rich markdown descriptions
  - Synonyms and alternative terms
  - Clinical pearls
  - Related differentials
  - Exam findings and lab values

---

## 🛠️ Configuration

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Required: Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here
```

### User Profile Customization

Configure your learning preferences in the app:

- **Discipline**: Medical (MD/DO), Nursing, Pharmacy, Physiotherapy, etc.
- **Training Level**: Student, Intern/Resident, Professional
- **Teaching Style**: Detailed, Concise, Case-Based, Visual
- **Specialties**: Cardiology, Neurology, Emergency Medicine, etc.
- **Learning Goals**: Board Exams, Clinical Practice, Research

---

## 📁 Project Structure

```
synapse-med/
├── App.tsx                    # Main application component
├── index.tsx                  # React entry point
├── types.ts                   # TypeScript type definitions
├── components/
│   ├── KnowledgeGraph.tsx     # D3.js force-directed graph
│   ├── NodeInspector.tsx      # Graph node details panel
│   ├── PodcastPlayer.tsx      # Audio playback interface
│   ├── ThinkingModal.tsx      # Real-time processing UI
│   ├── Onboarding.tsx         # First-time user guide
│   └── ProfileEditor.tsx      # User settings management
├── services/
│   └── geminiService.ts       # Gemini API integration
├── utils/
│   └── tableFormatter.ts      # Markdown table utilities
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🔒 Privacy & Security

- **No Server** - All processing happens client-side
- **Local Storage** - Notes stored in your browser only
- **API Key Security** - Gemini API key never leaves your device
- **No Tracking** - Zero analytics or user tracking
- **Open Source** - Full transparency, audit the code yourself

---

## 🚧 Roadmap

- [ ] Multi-language support
- [ ] Export to PDF/Anki flashcards
- [ ] Collaborative study groups
- [ ] Mobile app (React Native)
- [ ] Spaced repetition scheduling
- [ ] Image-based differential diagnosis quiz
- [ ] Integration with medical databases (PubMed, UpToDate)
- [ ] OCR for handwritten notes

---

## 🤝 Contributing

Contributions are welcome! This project is under active development.

```bash
# Fork the repository
# Create a feature branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m 'Add amazing feature'

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Gemini** - AI foundation model (Gemini 2.5 Flash & Pro)
- **D3.js** - Data visualization library
- **React** - UI framework
- **Lucide** - Beautiful icon set
- Medical educators and students who inspire this project

---

## 📧 Contact

**Developer**: hareeshkar  
**Project Link**: [https://github.com/hareeshkar/synapse-med](https://github.com/hareeshkar/synapse-med)

---

## ⚠️ Disclaimer

This tool is designed as a **study aid** and should not replace professional medical advice, diagnosis, or treatment. Always verify information with authoritative sources and consult qualified healthcare professionals for medical decisions.

---

<div align="center">

**Built with ❤️ for medical learners**

[Report Bug](https://github.com/hareeshkar/synapse-med/issues) · [Request Feature](https://github.com/hareeshkar/synapse-med/issues) · [Documentation](https://github.com/hareeshkar/synapse-med/wiki)

</div>
