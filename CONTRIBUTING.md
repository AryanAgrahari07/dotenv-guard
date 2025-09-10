# Contributing to dotenv-shield

Thank you for your interest in contributing to dotenv-shield! We welcome contributions from the community and are grateful for any help you can provide.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Coding Standards](#coding-standards)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project adheres to a code of conduct adapted from the [Contributor Covenant](https://www.contributor-covenant.org/). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

- Be respectful and inclusive
- Focus on what is best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully
- Use welcoming and inclusive language

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment
4. Create a feature branch
5. Make your changes
6. Test your changes
7. Submit a pull request

## Development Setup

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn
- Git

### Installation

```bash
# Clone your fork
git clone https://github.com/AryanAgrahari07/dotenv-shield.git
cd dotenv-shield

# Install dependencies
npm install

# Run tests to ensure everything is working
npm test

# Test the CLI locally
node bin/dotenv-shield.js --help
```

### Project Structure

```
dotenv-shield/
├── bin/
│   └── dotenv-shield.js          # CLI entry point
├── src/
│   ├── index.js              # Main API exports
│   ├── generate.js           # Schema generation logic
│   ├── validate.js           # Validation logic
│   └── utils.js              # Utility functions
├── tests/                    # Test files
├── examples/                 # Example projects
└── docs/                     # Documentation
```

## How to Contribute

### Types of Contributions

We welcome several types of contributions:

1. **Bug Reports**: Found a bug? Please report it!
2. **Feature Requests**: Have an idea for a new feature?
3. **Bug Fixes**: Submit a fix for a known issue
4. **New Features**: Implement a requested feature
5. **Documentation**: Improve docs, examples, or comments
6. **Tests**: Add or improve test coverage

### Before You Start

- Check existing issues and pull requests to avoid duplicates
- For major changes, open an issue first to discuss your approach
- Make sure you understand the project's goals and architecture

## Pull Request Process

1. **Create a branch** from `main` with a descriptive name:
   ```bash
   git checkout -b feature/add-typescript-support
   git checkout -b fix/validation-error-messages
   git checkout -b docs/improve-api-examples
   ```

2. **Make your changes**:
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed
   - Ensure all tests pass

3. **Test your changes**:
   ```bash
   # Run the full test suite
   npm test
   
   # Test CLI manually
   node bin/dotenv-shield.js generate
   node bin/dotenv-shield.js validate
   
   # Test with different Node versions if possible
   ```

4. **Commit your changes**:
   - Use clear, descriptive commit messages
   - Follow conventional commit format when possible:
     ```
     feat: add TypeScript type generation
     fix: handle malformed JSON in validation
     docs: update API examples in README
     test: add tests for merge mode functionality
     ```

5. **Push and create PR**:
   ```bash
   git push origin your-branch-name
   ```
   - Open a pull request on GitHub
   - Fill out the PR template completely
   - Link any related issues

6. **Respond to feedback**:
   - Address review comments promptly
   - Make requested changes
   - Ask questions if feedback is unclear

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/generate.test.js
```

### Writing Tests

- Add tests for all new functionality
- Follow existing test patterns and naming conventions
- Use descriptive test names that explain what is being tested
- Include both positive and negative test cases
- Test edge cases and error conditions

Example test structure:
```javascript
describe('generateSchema', () => {
  it('should infer integer type for numeric values', () => {
    // Test implementation
  });

  it('should handle missing .env file gracefully', () => {
    // Test implementation
  });
});
```

### Test Categories

1. **Unit Tests**: Test individual functions and modules
2. **Integration Tests**: Test CLI commands end-to-end
3. **Edge Case Tests**: Test error conditions and boundary cases

## Coding Standards

### JavaScript/Node.js Style

- Use ES6+ features where appropriate
- Follow existing code formatting (consider adding Prettier)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Handle errors appropriately (don't ignore them)

### File Organization

- Keep files focused and cohesive
- Use clear, descriptive file names
- Organize imports at the top of files
- Export functions and classes explicitly

### Error Handling

- Provide clear, actionable error messages
- Use appropriate error types and exit codes
- Log errors consistently
- Don't expose sensitive information in errors

### CLI Design

- Follow Unix conventions for command-line tools
- Provide helpful help text and examples
- Use consistent flag names and patterns
- Support both long and short flag versions where appropriate

## Reporting Issues

### Before Reporting

- Search existing issues to avoid duplicates
- Try to reproduce the issue with the latest version
- Gather relevant information (Node.js version, OS, etc.)

### Issue Template

When reporting bugs, please include:

1. **Environment Information**:
   - Node.js version
   - npm/yarn version
   - Operating system
   - dotenv-shield version

2. **Steps to Reproduce**:
   - Clear, step-by-step instructions
   - Sample .env file if relevant
   - Expected vs actual behavior

3. **Additional Context**:
   - Error messages or stack traces
   - Relevant configuration files
   - Screenshots if applicable

### Feature Requests

For feature requests, please include:
- Use case and motivation
- Proposed API or interface
- Examples of how it would work
- Any related tools or prior art

## Development Tips

### Local Testing

Create a test project to manually verify your changes:

```bash
mkdir test-project
cd test-project
npm init -y

# Create sample .env
echo "PORT=3000" > .env
echo "DEBUG=true" >> .env
echo "DATABASE_URL=postgres://localhost/test" >> .env

# Test your local dotenv-shield
node ../dotenv-shield/bin/dotenv-shield.js generate
node ../dotenv-shield/bin/dotenv-shield.js validate
```

### Debugging

- Use `console.log()` or `debugger` for quick debugging
- The `DEBUG=dotenv-shield` environment variable enables verbose output
- Use Node.js debugging tools for complex issues

### Performance Considerations

- dotenv-shield should be fast for typical use cases
- Profile code if performance becomes an issue
- Consider memory usage for large projects
- Test with various project sizes

## Questions?

If you have questions about contributing, please:
1. Check this guide and the README
2. Search existing issues and discussions
3. Open a new issue with the "question" label
4. Reach out to maintainers

Thank you for contributing to dotenv-shield! 🚀