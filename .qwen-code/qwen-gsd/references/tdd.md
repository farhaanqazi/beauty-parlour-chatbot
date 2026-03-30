# Test-Driven Development (TDD) Workflow

A reference for implementing features using TDD: **Red → Green → Refactor**.

## The TDD Cycle

```
    ┌─────────────┐
    │     RED     │
    │ Write test  │
    │  (fails)    │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │    GREEN    │
    │  Implement  │
    │  (passes)   │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │  REFACTOR   │
    │   Clean up  │
    │ (still pass)│
    └──────┬──────┘
           │
           └──────────┐
                      │
                      ▼
                 Next test
```

## Step 1: RED — Write a Failing Test

### Before Writing Code

1. **Understand the requirement**
   - What behavior are you implementing?
   - What are the inputs and expected outputs?
   - What are the edge cases?

2. **Design the interface**
   - What function/class are you testing?
   - What are the parameters and return type?
   - How will it be used?

### Write the Test

```python
# Python example: test a function that doesn't exist yet
def test_calculate_discount():
    # Arrange
    price = 100
    discount_percent = 10
    
    # Act
    result = calculate_discount(price, discount_percent)
    
    # Assert
    assert result == 90
```

```typescript
// TypeScript example
describe('calculateDiscount', () => {
  it('should apply percentage discount to price', () => {
    // Arrange
    const price = 100;
    const discountPercent = 10;
    
    // Act
    const result = calculateDiscount(price, discountPercent);
    
    // Assert
    expect(result).toBe(90);
  });
});
```

### Run the Test (It Should Fail)

```bash
# Python
python -m pytest tests/test_pricing.py -v

# Node.js
npm test -- tests/pricing.test.ts
```

**Expected failure:**
- Function doesn't exist yet → `NameError` or `ReferenceError`
- Or function exists but returns wrong value → assertion failure

**If the test passes:**
- You already have this functionality → delete the test or check if it's testing the right thing
- The test is wrong → fix the test

## Step 2: GREEN — Implement the Minimum to Pass

### Implement Just Enough

Write the simplest code that makes the test pass:

```python
# Simplest implementation
def calculate_discount(price, discount_percent):
    return price * (1 - discount_percent / 100)
```

**Rules:**
- Don't add extra features "just in case"
- Don't optimize prematurely
- Don't add error handling unless the test requires it
- It's okay to hardcode values if that's what the test requires (for now)

### Run the Test (It Should Pass)

```bash
# Test passes
✓ test_calculate_discount passed
```

**If it still fails:**
- Read the error carefully
- Debug using the debug workflow
- Fix and re-run

## Step 3: REFACTOR — Clean Up Without Changing Behavior

### Review the Code

Ask:
- Is the code clear?
- Are there duplicates?
- Can naming be improved?
- Is there dead code?

### Refactor Safely

```python
# Refactored with better naming and validation
def calculate_discount(price: float, discount_percent: float) -> float:
    """Apply percentage discount to price."""
    if discount_percent < 0 or discount_percent > 100:
        raise ValueError("Discount must be between 0 and 100")
    return price * (1 - discount_percent / 100)
```

**Rules:**
- Don't change behavior — only structure
- Keep running tests to ensure nothing breaks
- Small refactoring steps, not big rewrites

### Run All Tests (Everything Should Still Pass)

```bash
# All tests pass
✓ test_calculate_discount
✓ test_calculate_discount_with_zero_discount
✓ test_calculate_discount_with_full_discount
```

## Example: Full TDD Session

### Test 1: Basic Discount

```python
# RED: Write test
def test_calculate_discount_basic():
    result = calculate_discount(100, 10)
    assert result == 90

# GREEN: Implement
def calculate_discount(price, discount_percent):
    return price * (1 - discount_percent / 100)

# REFACTOR: Nothing needed yet
```

### Test 2: Zero Discount

```python
# RED: Add test
def test_calculate_discount_zero():
    result = calculate_discount(100, 0)
    assert result == 100

# GREEN: Already passes! (no change needed)
# REFACTOR: Still clean
```

### Test 3: Invalid Discount

```python
# RED: Add test
def test_calculate_discount_invalid():
    with pytest.raises(ValueError):
        calculate_discount(100, 150)

# GREEN: Add validation
def calculate_discount(price, discount_percent):
    if discount_percent < 0 or discount_percent > 100:
        raise ValueError("Discount must be between 0 and 100")
    return price * (1 - discount_percent / 100)

# REFACTOR: Extract validation to separate function
def _validate_discount_percent(percent):
    if percent < 0 or percent > 100:
        raise ValueError("Discount must be between 0 and 100")

def calculate_discount(price, discount_percent):
    _validate_discount_percent(discount_percent)
    return price * (1 - discount_percent / 100)
```

## TDD for Bug Fixes

When fixing a bug:

1. **Write a test that reproduces the bug** (it will fail)
2. **Fix the bug** (test now passes)
3. **Refactor if needed** (tests ensure you don't reintroduce the bug)

```python
# Bug: calculate_discount(100, 100) returns 0, should return 0
# But calculate_discount(100, 101) also returns negative — that's the bug

# RED: Test for the bug
def test_calculate_discount_max_100():
    result = calculate_discount(100, 101)
    assert result >= 0  # Should not go negative

# GREEN: Fix
def calculate_discount(price, discount_percent):
    discount_percent = min(discount_percent, 100)  # Cap at 100
    return max(0, price * (1 - discount_percent / 100))

# REFACTOR: Better validation
def calculate_discount(price, discount_percent):
    _validate_discount_percent(discount_percent)
    return price * (1 - discount_percent / 100)
```

## When NOT to Use TDD

TDD is powerful but not always the right tool:

**Good for TDD:**
- Business logic with clear rules
- Mathematical calculations
- Data transformations
- API request/response handling

**Less useful for TDD:**
- UI styling and layout
- One-off scripts
- Exploratory prototyping
- External integration testing (use integration tests instead)

## TDD Checklist

- [ ] Test written before implementation
- [ ] Test fails for the right reason (RED)
- [ ] Implementation is minimal (GREEN)
- [ ] All tests pass
- [ ] Code is clean and readable (REFACTOR)
- [ ] No behavior changed during refactor
- [ ] All existing tests still pass
