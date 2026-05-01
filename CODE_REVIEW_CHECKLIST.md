# Code Review Checklist

Use this checklist when reviewing code changes for the StarPath Astrology project.

## General

- [ ] Code follows the project's style guide
- [ ] All CI checks pass
- [ ] No hardcoded secrets or credentials
- [ ] No console.log statements in production code
- [ ] Proper error handling in place

## TypeScript

- [ ] Types are properly defined
- [ ] No `any` types without justification
- [ ] Explicit return types on functions
- [ ] Proper null/undefined handling

## React/Next.js

- [ ] Components are properly typed
- [ ] Props are validated
- [ ] No unused imports
- [ ] Proper use of React hooks
- [ ] Client/server components correctly distinguished

## Security

- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (Prisma queries)
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Proper auth checks

## Performance

- [ ] No unnecessary re-renders
- [ ] Proper use of caching
- [ ] Database queries are optimized
- [ ] Images are properly optimized

## Testing

- [ ] Unit tests added for new logic
- [ ] Integration tests where appropriate
- [ ] Manual testing completed

## Documentation

- [ ] JSDoc comments for complex functions
- [ ] README updated if needed
- [ ] API documentation updated
