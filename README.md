# Agentic AI 2026

Agent-to-Agent Communication & AgentOps - The Future of Autonomous AI Systems

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Deployment

This project uses two branches for deployment:
- `guide`: Source code branch
- `guide-pages`: Built static files (auto-deployed by GitHub Actions)

When changes are pushed to the `guide` branch, GitHub Actions automatically builds and deploys to `guide-pages`.

## GitHub Pages Setup

1. Go to repository Settings > Pages
2. Set Source: Deploy from a branch
3. Set Branch: `guide-pages` / `/ (root)`
4. Save

Site will be available at: https://mypalesong.github.io/agent/
