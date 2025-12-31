# Contributing to Synapse Med

Thank you for your interest in contributing to Synapse Med! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- A Google Gemini API key for testing
- Basic knowledge of React, TypeScript, and D3.js

### Development Setup

1. **Fork the repository**

   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**

   ```bash
   git clone https://github.com/hareeshkar/synapse-med.git
   cd synapse-med
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/hareeshkar/synapse-med.git
   ```

4. **Install dependencies**

   ```bash
   npm install
   ```

5. **Set up environment**

   ```bash
   cp .env.example .env.local
   # Add your GEMINI_API_KEY to .env.local
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

## 🔀 Making Changes

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/export-to-pdf`)
- `fix/` - Bug fixes (e.g., `fix/graph-rendering-issue`)
- `docs/` - Documentation updates (e.g., `docs/update-readme`)
- `refactor/` - Code refactoring (e.g., `refactor/gemini-service`)
- `test/` - Adding tests (e.g., `test/knowledge-graph`)

### Workflow

1. **Create a new branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Write clean, readable code
   - Follow the existing code style
   - Add comments for complex logic
   - Update types in `types.ts` if needed

3. **Test your changes**

   ```bash
   npm run build
   # Manual testing in the browser
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

   **Commit Message Format:**

   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting, etc.)
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

5. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill out the PR template

## 📝 Code Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Define proper types (avoid `any`)
- Use interfaces for object shapes
- Export types from `types.ts`

### React

- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use meaningful component and variable names

### CSS

- Use the existing color variables
- Follow the clinical theme (charcoal, obsidian, etc.)
- Ensure responsive design
- Test dark mode appearance

### Comments

```typescript
// ✅ GOOD: Explain WHY, not WHAT
// Retry with exponential backoff to handle Gemini rate limits
private async retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  // ...
}

// ❌ BAD: Obvious comment
// This function retries a function
private async retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  // ...
}
```

## 🧪 Testing

Currently, testing is manual. When adding new features:

1. Test with various file types (PDF, image, audio)
2. Test knowledge graph interactions
3. Test on different browsers (Chrome, Firefox, Safari)
4. Test responsive design on mobile
5. Verify LocalStorage persistence

## 🐛 Bug Reports

When reporting bugs, please include:

- **Description** - Clear description of the issue
- **Steps to Reproduce** - Detailed steps to reproduce
- **Expected Behavior** - What should happen
- **Actual Behavior** - What actually happens
- **Screenshots** - If applicable
- **Environment** - Browser, OS, Node version
- **Error Messages** - Console errors or stack traces

## 💡 Feature Requests

When requesting features:

- **Use Case** - Why is this feature needed?
- **Proposed Solution** - How should it work?
- **Alternatives** - Other ways to achieve the goal
- **Additional Context** - Screenshots, mockups, examples

## 🎯 Priority Areas for Contribution

### High Priority

- [ ] Unit and integration tests
- [ ] Export to PDF/Anki functionality
- [ ] Mobile responsiveness improvements
- [ ] Accessibility (ARIA labels, keyboard navigation)
- [ ] Performance optimization (large file handling)

### Medium Priority

- [ ] Internationalization (i18n)
- [ ] Additional knowledge graph layouts
- [ ] Advanced search and filtering
- [ ] Cloud sync (optional)
- [ ] Offline mode with service workers

### Low Priority

- [ ] UI themes and customization
- [ ] Additional podcast voices
- [ ] Social sharing features

## 📚 Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [D3.js Documentation](https://d3js.org/)
- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Vite Guide](https://vitejs.dev/guide/)

## 🤝 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what's best for the community
- Show empathy towards other contributors

## ❓ Questions?

- Open a [Discussion](https://github.com/hareeshkar/synapse-med/discussions)
- Create an [Issue](https://github.com/hareeshkar/synapse-med/issues)
- Contact the maintainer

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for making Synapse Med better! 🎉**
