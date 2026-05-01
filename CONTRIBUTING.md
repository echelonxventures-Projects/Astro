# Contributing to StarPath Astrology

Thank you for your interest in contributing to StarPath Astrology.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/starpath-astrology.git`
3. Install dependencies: `npm install`
4. Set up environment variables (see `.env.example`)
5. Run database setup: `npm run db:setup-postgres`
6. Start development server: `npm run dev`

## Development Workflow

### Branch Naming

- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`

### Commit Messages

Follow conventional commits format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build process or auxiliary tool changes

Example: `feat: add birth chart calculation`

### Pre-commit Hooks

This project uses husky and lint-staged. The pre-commit hook will:

1. Run ESLint with auto-fix
2. Run Prettier for formatting
3. Check for unused imports

Ensure your code passes these checks before committing.

## Code Style

- We use Prettier for formatting (configured in `.prettierrc`)
- ESLint for linting (configured in `eslint.config.mjs`)
- EditorConfig for editor consistency (`.editorconfig`)

### Key Style Rules

- No semicolons
- Single quotes
- 2-space indentation
- 100 character line width
- LF line endings

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Ensure all pre-commit hooks pass
4. Push your branch and open a Pull Request
5. Fill out the PR template completely
6. Request review from maintainers
7. Address review feedback
8. Merge only after approval

## Testing

- Test your changes locally before submitting
- Ensure existing tests still pass
- Add tests for new functionality
- Manually test UI changes in multiple browsers

## Questions?

Feel free to open an issue for:

- Bug reports
- Feature requests
- Documentation improvements
- General questions

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on what's best for the project
- Show empathy towards others
