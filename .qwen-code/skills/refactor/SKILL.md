---
name: refactor
description: Use when restructuring code to improve readability, maintainability, or architecture without changing behavior. Handles extract function, rename, split module, and behavior preservation checks.
---

# Refactor Skill

Safely restructure code while preserving behavior through systematic refactoring patterns.

## When to Use

- Code is hard to understand or modify
- Functions are too long (>50 lines)
- Files have too many responsibilities
- Duplicate code exists
- Naming is unclear
- Preparing code for new features

## Refactoring Principles

### Rule 1: Small Steps
Make one change at a time. Run tests after each step.

### Rule 2: Behavior Preservation
The code should work exactly the same after refactoring. Only internal structure changes.

### Rule 3: Tests First
Never refactor without tests. If tests don't exist, write characterization tests first.

## Common Refactoring Patterns

### 1. Extract Function

**Before:**
```python
def process_order(order):
    # Calculate subtotal
    subtotal = 0
    for item in order['items']:
        subtotal += item['price'] * item['quantity']
    
    # Calculate tax
    tax_rate = 0.08 if order['state'] == 'CA' else 0.06
    tax = subtotal * tax_rate
    
    # Calculate shipping
    shipping = 5.99 if subtotal < 50 else 0
    
    # Total
    total = subtotal + tax + shipping
    
    return {
        'subtotal': subtotal,
        'tax': tax,
        'shipping': shipping,
        'total': total
    }
```

**After:**
```python
def process_order(order):
    subtotal = calculate_subtotal(order['items'])
    tax = calculate_tax(subtotal, order['state'])
    shipping = calculate_shipping(subtotal)
    total = subtotal + tax + shipping
    
    return {
        'subtotal': subtotal,
        'tax': tax,
        'shipping': shipping,
        'total': total
    }

def calculate_subtotal(items):
    return sum(item['price'] * item['quantity'] for item in items)

def calculate_tax(subtotal, state):
    tax_rate = 0.08 if state == 'CA' else 0.06
    return subtotal * tax_rate

def calculate_shipping(subtotal):
    return 5.99 if subtotal < 50 else 0
```

### 2. Rename Variable/Function

**Before:**
```python
def calc(d, r):
    return d * (1 + r)

result = calc(100, 0.08)
```

**After:**
```python
def calculate_total_with_tax(base_price, tax_rate):
    return base_price * (1 + tax_rate)

result = calculate_total_with_tax(100, 0.08)
```

**Rename checklist:**
- [ ] Rename all usages (IDE refactoring tool recommended)
- [ ] Update documentation
- [ ] Update tests
- [ ] Check for string literals with old name

### 3. Split Module

**Before:** `users.py` (500 lines)
```python
# Contains: User model, validation, email sending, API handlers, tests helpers

class User:
    ...

def validate_user(user):
    ...

def send_welcome_email(user):
    ...

def handle_create_user(request):
    ...

def handle_get_user(request):
    ...

# ... 400 more lines
```

**After:**
```
users/
├── __init__.py
├── models.py        # User class
├── validators.py    # validate_user
├── emails.py        # send_welcome_email
├── handlers.py      # API handlers
└── tests/
    ├── test_models.py
    ├── test_validators.py
    └── test_handlers.py
```

**Split process:**
1. Identify cohesive groups of functions
2. Create new files for each group
3. Move functions one at a time
4. Update imports
5. Run tests after each move

### 4. Replace Conditional with Polymorphism

**Before:**
```python
def get_discount(customer, amount):
    if customer['type'] == 'vip':
        return amount * 0.2
    elif customer['type'] == 'wholesale':
        return amount * 0.15
    elif customer['type'] == 'regular':
        return amount * 0.05
    else:
        return 0
```

**After:**
```python
class Customer:
    def get_discount(self, amount):
        return 0

class VIPCustomer(Customer):
    def get_discount(self, amount):
        return amount * 0.2

class WholesaleCustomer(Customer):
    def get_discount(self, amount):
        return amount * 0.15

class RegularCustomer(Customer):
    def get_discount(self, amount):
        return amount * 0.05

# Usage
discount = customer.get_discount(amount)
```

### 5. Introduce Parameter Object

**Before:**
```python
def create_user(email, name, password, street, city, state, zip_code, country):
    ...
```

**After:**
```python
def create_user(email, name, password, address):
    # address = {'street': ..., 'city': ..., 'state': ..., 'zip': ..., 'country': ...}
    ...
```

## Refactoring Workflow

### Step 1: Identify the Smell

Common code smells:
- **Long method:** Function >50 lines
- **Large class:** Class with >10 methods
- **Duplicate code:** Same logic in multiple places
- **Long parameter list:** Function with >4 parameters
- **Feature envy:** Method uses other class's data more than its own
- **Data clumps:** Same group of data passed around together

### Step 2: Choose the Pattern

| Smell | Pattern |
|-------|---------|
| Long method | Extract function |
| Large class | Split module, extract class |
| Duplicate code | Extract function, pull up method |
| Long parameter list | Introduce parameter object |
| Feature envy | Move method |
| Data clumps | Introduce parameter object |

### Step 3: Ensure Test Coverage

Run existing tests. If coverage is low:
- Write characterization tests
- Test the current behavior (even if wrong)
- Document edge cases

### Step 4: Apply the Pattern

Make small changes. Run tests frequently.

### Step 5: Verify Behavior

- All tests pass
- Manual testing confirms behavior unchanged
- Code review by teammate

## Safety Checklist

Before committing refactoring:
- [ ] All tests pass
- [ ] No behavior changes (verified by tests)
- [ ] No TODOs or temporary comments left
- [ ] Documentation updated if public API changed
- [ ] Import statements updated
- [ ] No dead code left behind

## Tools

**Python:**
```bash
# Ruff for linting
ruff check src/

# Black for formatting
black src/

# Pyright for type checking
pyright src/
```

**JavaScript/TypeScript:**
```bash
# ESLint
npm run lint

# Prettier
npm run format

# TypeScript compiler
tsc --noEmit
```

**IDE Refactoring:**
- VS Code: Built-in rename, extract, move
- PyCharm: Extensive refactoring support
- IntelliJ: Java/Kotlin refactoring
