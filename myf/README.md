# ⚡ Power BI Chatbot UI

A professional, enterprise-grade chatbot interface for Power BI developer support that replicates ChatGPT's UI/UX while adding Power BI-specific features.

![Power BI Assistant](https://img.shields.io/badge/Power%20BI-Assistant-F2C94C?style=for-the-badge&logo=powerbi)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)

## 🎯 Features

### ✅ ChatGPT-Identical UI
- **Exact message composer** - Auto-resize, Enter=send, Shift+Enter=newline
- **Token streaming** - Real-time response rendering with typing indicators
- **Smooth animations** - Framer Motion micro-interactions throughout
- **Responsive design** - Desktop, tablet, and mobile layouts

### 🎨 Power BI-Specific Features
- **DAX/PowerQuery code highlighting** - Syntax highlighting for 20+ languages
- **Interactive data tables** - Search, sort, export to CSV
- **7 chart types** - Bar, Line, Pie, Area, Scatter, Donut, Histogram
- **File uploads** - PBIX, CSV, XLSX, JSON, PNG, JPG, PDF support
- **Referenced sources panel** - Track data sources and citations

### 💬 Message Actions
- **Like/Dislike** - With detailed feedback modal
- **Copy** - One-click copy with confirmation
- **Regenerate** - Get alternative AI responses
- **Edit** - Edit user messages with undo support
- **Pin/Delete/Export** - Full conversation management

### 🧪 Developer Tools
- **Debug panel** - Adjust API latency, streaming speed, error rates
- **Live telemetry** - Track messages, likes, copies, edits, etc.
- **Mock API** - Fully functional without backend
- **5 seeded conversations** - Pre-loaded with rich sample data

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun
- npm/yarn/pnpm

### Installation

```bash
# Clone the repository
cd Tetra-Agentic-UI

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit **http://localhost:8080/** to see the app in action!

### First Steps

1. **Explore existing conversations** - Click conversations in sidebar
2. **Try message actions** - Hover over messages to see Like, Copy, Regenerate
3. **Test file upload** - Drag files onto the message composer
4. **Open debug panel** - Bottom-right corner to adjust API behavior
5. **Start a new chat** - Click "New Chat" and select a starter prompt

## 📚 Documentation

- **[Quick Start Guide](QUICK_START.md)** - 2-minute walkthrough
- **[Full Documentation](POWERBI_CHAT_DOCS.md)** - Complete feature reference
- **[Component Reference](COMPONENT_REFERENCE.md)** - Architecture deep-dive

## 🏗️ Project Structure

```
src/
├── components/chat/          # All chat UI components
│   ├── MessageComposer.tsx   # ChatGPT-identical input
│   ├── MessageBubbleNew.tsx  # Message rendering
│   ├── DataTableCard.tsx     # Interactive tables
│   ├── ChartCard.tsx         # Chart visualizations
│   └── ...
├── data/
│   └── dummyConversations.ts # 5 sample conversations
├── lib/
│   └── mockAPI.ts            # Mock backend with streaming
├── types/
│   └── powerbi-chat.ts       # TypeScript interfaces
└── pages/
    └── PowerBIChat.tsx       # Main chat page
```

## 🎨 Tech Stack

- **React 18.3** - UI framework
- **TypeScript 5.8** - Type safety
- **Tailwind CSS 3.4** - Utility-first styling
- **shadcn/ui** - High-quality component library
- **Framer Motion** - Smooth animations
- **Recharts** - Data visualizations
- **React Markdown** - Markdown rendering
- **React Syntax Highlighter** - Code highlighting

## 💡 Key Highlights

### Message Streaming
Real-time token-by-token rendering just like ChatGPT:
```typescript
await mockSendMessage(request, (chunk, fullContent) => {
  updateMessage(fullContent);
});
```

### Interactive Tables
Full-featured tables with search, sort, and export:
- Click column headers to sort
- Real-time search filtering
- Copy as TSV or export as CSV
- Click to expand in modal

### Chart Expansion
Thumbnail charts expand to full-screen with:
- Chart type switching
- Export to PNG/SVG/CSV
- Detailed insights panel

### Edit Mode
Full message editing with:
- "Editing message" banner
- Save/Cancel actions
- "edited" badge on modified messages
- Undo toast notification

## 🎯 Demo Scenarios

### 1. Explore DAX Troubleshooting
```
Conversation: "DAX Measure Returning Blank"
→ See syntax-highlighted DAX code
→ Notice diagnostic steps
→ Try copying code blocks
```

### 2. Analyze Data Tables
```
Conversation: "Q3 Sales Performance Analysis"
→ Click column headers to sort
→ Search for "Europe"
→ Click "Export CSV"
→ Expand table in modal
```

### 3. Interactive Chat
```
1. Click "New Chat"
2. Type: "Why is my Power BI report slow?"
3. Watch typing indicator
4. See response stream in
5. Click "Regenerate" for alternative answer
```

## 🔧 Configuration

### Debug Panel Controls

Open the debug panel (bottom-right) to adjust:

- **API Latency** (0-5000ms) - Simulate slow networks
- **Streaming Speed** (1-50 chars) - Control token speed
- **Error Rate** (0-100%) - Test error handling
- **Upload Failure** (0-100%) - Test upload errors

### Mock API Behavior

Customize in `src/lib/mockAPI.ts`:
```typescript
updateMockAPIConfig({
  latency: 2000,        // 2 second delay
  streamingSpeed: 10,   // 10 chars per chunk
  errorRate: 0.1,       // 10% error rate
});
```

## 📱 Responsive Design

- **Desktop (>1024px)**: Persistent sidebar, two-column layout
- **Tablet (768-1024px)**: Collapsible sidebar, touch-friendly
- **Mobile (<768px)**: Full-width, slide-over sidebar

## ♿ Accessibility

- ✅ Full keyboard navigation
- ✅ ARIA labels on all controls
- ✅ Screen reader support
- ✅ Focus management
- ✅ Reduced motion mode

## 🎉 What's Included

- ✅ 15+ chat components
- ✅ 5 seeded conversations with rich content
- ✅ Mock API with streaming support
- ✅ Interactive tables and charts
- ✅ File upload with progress
- ✅ Message actions (like, copy, edit, regenerate)
- ✅ Debug panel with telemetry
- ✅ Full TypeScript support
- ✅ Responsive mobile layout
- ✅ Comprehensive documentation

## 🚧 Backend Integration

This is a frontend-only prototype. To connect a real backend:

1. Replace mock API calls in `src/lib/mockAPI.ts`
2. Implement WebSocket for streaming
3. Add authentication
4. Set up file storage
5. Implement conversation persistence

See [Full Documentation](POWERBI_CHAT_DOCS.md) for integration details.

## 📦 Build & Deploy

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

Deploy to Vercel, Netlify, or any static hosting platform.

## 🤝 Contributing

This is a demonstration project. Feel free to:
- Fork and customize
- Add new features
- Improve styling
- Connect to real backends

## 📄 License

MIT License - feel free to use for personal or commercial projects.

## 🎓 Learn More

- **[React Documentation](https://react.dev/)**
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)**
- **[Tailwind CSS](https://tailwindcss.com/docs)**
- **[Framer Motion](https://www.framer.com/motion/)**
- **[shadcn/ui](https://ui.shadcn.com/)**

---

**Built for Power BI developers, by developers** ⚡

Made with ❤️ using React, TypeScript, and Tailwind CSS
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
