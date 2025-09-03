# Prepigo

**An intelligent, offline-first study companion for medical students and professionals**

Prepigo is a comprehensive Progressive Web Application (PWA) designed to revolutionize medical education through spaced repetition, gamification, and intelligent study management. Built with modern web technologies, it provides a seamless offline-first experience for studying flashcards, practicing MCQs, taking exams, and tracking progress.

## ✨ Features

### 📚 **Flashcard Management**

- **Multiple Card Types**: Basic Q&A, Cloze deletion, and Image occlusion cards
- **Hierarchical Decks**: Organize cards in nested deck structures
- **Advanced SRS**: FSRS (Free Spaced Repetition Scheduler) and SM-2 algorithms
- **Custom Study Sessions**: Tailored study sessions based on due cards, difficulty, or tags
- **PDF Integration**: Create flashcards directly from PDF resources with source linking

### 🧠 **MCQ Practice & Question Banks**

- **Question Bank Management**: Organize MCQs in categorized banks
- **Practice Modes**: Timed practice, review sessions, and mistake analysis
- **Performance Tracking**: Detailed analytics on accuracy, speed, and improvement
- **Custom Practice Setup**: Filter by difficulty, tags, or specific question banks

### 📝 **Exam System**

- **Exam Scheduler**: Plan and schedule exams with multiple question sources
- **Exam Sessions**: Full-featured exam interface with timer and progress tracking
- **Results Analysis**: Comprehensive performance breakdown with mistake review
- **Exam History**: Track performance trends over time

### 🎮 **Gamification**

- **XP & Leveling System**: Earn experience points for study activities
- **Achievement System**: Unlock achievements for various milestones
- **Streak Tracking**: Maintain study streaks for consistent learning
- **Progress Notifications**: Real-time feedback on accomplishments

### 📊 **Analytics & Progress Tracking**

- **Study Statistics**: Comprehensive analytics on study time, cards reviewed, and performance
- **Performance Trends**: Visual charts showing improvement over time
- **Goal Setting**: Set and track daily/weekly study goals
- **Detailed Logs**: Complete history of all study activities

### 📱 **Modern User Experience**

- **Offline-First**: Full functionality without internet connection
- **Progressive Web App**: Install on any device like a native app
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Dark/Light Theme**: Customizable appearance preferences
- **Multi-tab Sync**: Real-time synchronization across browser tabs

### 📄 **Resource Management**

- **PDF Viewer**: Built-in PDF viewer with annotation capabilities
- **Resource Library**: Organize and access study materials
- **Source Linking**: Connect flashcards to specific PDF pages and selections

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 20.x LTS (pinned for compatibility)
- **Package Manager**: pnpm (recommended)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/prepigo.git
   cd prepigo
   ```

2. **Use the correct Node.js version**

   ```bash
   nvm use              # ensures Node 20.x
   # If not installed: nvm install 20 && nvm use 20
   ```

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Start development server**

   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

### Production Build

```bash
pnpm build          # production build
pnpm preview        # preview production build
```

## 🛠️ Technology Stack

### **Frontend Framework**

- **React 18** with TypeScript (strict mode)
- **Vite** for fast development and building
- **React Router** for client-side routing

### **UI & Styling**

- **Tailwind CSS** for utility-first styling
- **shadcn/ui** component library
- **Radix UI** primitives for accessibility
- **Framer Motion** for animations
- **Lucide React** for icons

### **Data & State Management**

- **TanStack Query** for server state and caching
- **React Context** for global state management
- **Dexie.js** for IndexedDB operations
- **Zod** for runtime type validation

### **Offline & PWA**

- **Workbox** for service worker and caching strategies
- **vite-plugin-pwa** for PWA configuration
- **IndexedDB** for offline data storage
- **Background sync** for data synchronization

### **Development Tools**

- **TypeScript** with strict configuration
- **ESLint** for code linting
- **Prettier** for code formatting
- **Husky** for git hooks
- **Playwright** for end-to-end testing
- **Vitest** for unit testing

### **Monitoring & Analytics**

- **Sentry** for error tracking and performance monitoring
- **Built-in analytics** for study progress tracking

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── gamification/   # Gamification-related components
│   └── resources/      # Resource management components
├── contexts/           # React Context providers
│   ├── DecksContext.tsx
│   ├── ExamsContext.tsx
│   ├── GamificationContext.tsx
│   └── SettingsContext.tsx
├── data/              # Data models and schemas
│   ├── decks.ts       # Flashcard and deck schemas
│   ├── exams.ts       # Exam data schemas
│   └── gamification.ts # Gamification data models
├── lib/               # Utility functions and services
│   ├── storage.ts     # IndexedDB operations
│   ├── sync.ts        # Data synchronization
│   └── deck-utils.ts  # Deck manipulation utilities
├── pages/             # Route components
│   ├── Index.tsx      # Home page
│   ├── StudyPage.tsx  # Study session interface
│   ├── ExamSessionPage.tsx # Exam interface
│   └── StatisticsPage.tsx  # Analytics dashboard
└── App.tsx            # Main application component
```

## 🔧 Development

### **Code Standards**

- TypeScript strict mode enabled
- ESLint and Prettier for code quality
- Comprehensive type safety with Zod schemas
- Component-driven architecture with shadcn/ui

### **Database Schema**

- **Offline-first** architecture using IndexedDB
- **Versioned migrations** for schema changes
- **Multi-tab synchronization** via BroadcastChannel
- **Conflict resolution** for concurrent edits

### **Testing**

```bash
pnpm test              # run unit tests
pnpm e2e               # run end-to-end tests
pnpm typecheck         # type checking
pnpm lint              # linting
```

### **Contributing**

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines, coding standards, and database migration procedures.

## 📱 PWA Features

- **Installable**: Add to home screen on any device
- **Offline Functionality**: Full app functionality without internet
- **Background Sync**: Automatic data synchronization when online
- **Push Notifications**: Study reminders and achievement notifications
- **Responsive Design**: Optimized for all screen sizes

## 🎯 Use Cases

### **Medical Students**

- Study for exams with spaced repetition
- Practice MCQs from question banks
- Track study progress and performance
- Create flashcards from textbooks and PDFs

### **Medical Professionals**

- Continuing education and certification prep
- Quick review of medical concepts
- Maintain knowledge through regular practice
- Track professional development goals

### **Educators**

- Create and share study materials
- Monitor student progress
- Develop comprehensive question banks
- Analyze learning patterns

## 🔒 Privacy & Data

- **Local-first**: All data stored locally on your device
- **No tracking**: No user analytics or data collection
- **Offline-capable**: No internet required for core functionality
- **Export/Import**: Full control over your study data

## 🚀 Deployment

The application is configured for deployment on modern hosting platforms:

- **Vercel**: Optimized configuration included
- **Netlify**: PWA-ready build output
- **Self-hosted**: Standard static site deployment

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Setting up the development environment
- Code style and standards
- Database migration procedures
- Submitting pull requests

## 📞 Support

- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/Riso19/Prepigo/issues)
- **Discussions**: Join community discussions in [GitHub Discussions](https://github.com/Riso19/Prepigo/discussions)
- **Documentation**: Check the [Wiki](https://github.com/your-username/prepigo/wiki) for detailed guides

## 🙏 Acknowledgments

- **FSRS Algorithm**: Advanced spaced repetition scheduling
- **shadcn/ui**: Beautiful and accessible UI components
- **Radix UI**: Primitive components for accessibility
- **Medical Community**: Inspiration and feedback from medical professionals

---

**Built with ❤️ for the medical education community**
