---
name: readme-generator
description: Use when creating or updating README.md files for projects. Produces professional documentation with badges, installation instructions, usage examples, API reference, and contributing guidelines.
---

# README Generator Skill

Create professional, comprehensive README files that help users understand and use your project.

## When to Use

- Starting a new open-source project
- Documenting a library or framework
- Onboarding new team members
- Publishing to npm, PyPI, or GitHub
- Improving project discoverability

## README Structure

```markdown
# Project Name

[Badges]

[One-line description]

## Table of Contents

- [What it is](#what-it-is)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Examples](#examples)
- [Development](#development)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)
```

## Badges

```markdown
[![npm version](https://badge.fury.io/js/package-name.svg)](https://badge.fury.io/js/package-name)
[![Downloads](https://img.shields.io/npm/dm/package-name.svg)](https://npmjs.com/package/package-name)
[![Build Status](https://github.com/user/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/user/repo/actions)
[![Coverage](https://codecov.io/gh/user/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/user/repo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

**Python badges:**
```markdown
[![PyPI version](https://badge.fury.io/py/package-name.svg)](https://badge.fury.io/py/package-name)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
```

## What It Is

```markdown
## What It Is

[Project name] is a [type of tool] that helps [target users] [solve problem] by [how it works].

Unlike [alternative], [project name] [key differentiator].
```

**Example:**
```markdown
## What It Is

Qwen-GSD is a skills and workflow system for Qwen Code that extends the AI's capabilities with 20+ specialized skills for database design, API development, debugging, and more.

Unlike generic AI assistants, Qwen-GSD provides structured, repeatable workflows with spec-driven development patterns.
```

## Features

```markdown
## Features

- **Feature 1:** [Benefit]
- **Feature 2:** [Benefit]
- **Feature 3:** [Benefit]
```

**Example:**
```markdown
## Features

- **20+ Specialized Skills:** Database schema design, API development, debugging, Docker, and more
- **Spec-Driven Workflows:** Plan → Build → Review → Ship with clear acceptance criteria
- **Subagent Integration:** Delegate complex tasks to specialized AI agents
- **Project Memory:** Maintain context across sessions with STATE.md
```

## Installation

### npm

```markdown
## Installation

```bash
# Install globally
npm install -g package-name

# Or use with npx
npx package-name --help
```
```

### PyPI

```markdown
## Installation

```bash
# Install with pip
pip install package-name

# Or with poetry
poetry add package-name
```
```

### From Source

```markdown
### From Source

```bash
git clone https://github.com/user/repo.git
cd repo
npm install  # or pip install -e .
```
```

## Quick Start

```markdown
## Quick Start

```bash
# Step 1: [action]
[command]

# Step 2: [action]
[command]

# Step 3: [action]
[command]
```

**Example:**
```markdown
## Quick Start

```bash
# Initialize a new project
/qwen:new-project

# Plan the first phase
/qwen:plan 1

# Build from the plan
/qwen:build
```
```

## Usage

```markdown
## Usage

### Basic Example

```[language]
[code example]
```

### Advanced Usage

```[language]
[advanced example]
```

### Configuration

```[language]
[config example]
```
```

## API Reference

```markdown
## API Reference

### `functionName(param1, param2)`

[Description of what the function does]

**Parameters:**
- `param1` (type): [Description]
- `param2` (type): [Description]

**Returns:** (type) [Description]

**Example:**
```[language]
const result = functionName(value1, value2);
```
```

## Configuration

```markdown
## Configuration

[Project name] can be configured via environment variables, config files, or command-line flags.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VAR_NAME` | [Description] | `default` |

### Config File

Create `.config.json`:

```json
{
  "key": "value"
}
```
```

## Examples

```markdown
## Examples

### Example 1: [Use Case]

```[language]
[code]
```

### Example 2: [Use Case]

```[language]
[code]
```
```

## Development

```markdown
## Development

```bash
# Clone the repository
git clone https://github.com/user/repo.git
cd repo

# Install dependencies
npm install  # or pip install -e ".[dev]"

# Run development server
npm run dev  # or uvicorn main:app --reload
```

### Building

```bash
npm run build  # or python -m build
```
```

## Testing

```markdown
## Testing

```bash
# Run all tests
npm test  # or pytest

# Run with coverage
npm run test:coverage  # or pytest --cov

# Run specific test file
npm test -- tests/specific.test.js
```
```

## Contributing

```markdown
## Contributing

Contributions are welcome! Here's how to contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.
```

## License

```markdown
## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
```

## Complete README Template

```markdown
# Project Name

[![npm version](https://badge.fury.io/js/package-name.svg)](https://badge.fury.io/js/package-name)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[One-line description of what this project does]

## Table of Contents

- [What It Is](#what-it-is)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## What It Is

[Project name] is a [type] that helps [users] [solve problem].

## Features

- **Feature 1:** [Benefit]
- **Feature 2:** [Benefit]
- **Feature 3:** [Benefit]

## Installation

```bash
npm install package-name
# or
pip install package-name
```

## Quick Start

```[language]
import package from 'package-name';

const result = package.function();
console.log(result);
```

## Usage

### Basic Example

```[language]
// Code example
```

### Advanced Usage

```[language]
// Advanced example
```

## API Reference

### `functionName(param)`

[Description]

**Parameters:**
- `param` (type): Description

**Returns:** type

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push and open a PR

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.
```
