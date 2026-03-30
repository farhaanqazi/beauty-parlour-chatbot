---
name: test-writer
description: Write tests for existing code. Use when the user wants unit tests, integration tests, or a full test suite added to their codebase. Covers Python (pytest), JavaScript/TypeScript (Jest/Vitest), and general testing patterns.
---

# Test Writer Skill

Write meaningful tests that catch real bugs — not just tests for coverage.

## Approach

1. Read the code to understand what it actually does
2. Identify the critical paths and edge cases (not just the happy path)
3. Write tests that would fail if the code broke in a real way
4. Name tests so failures explain themselves

## What to Test

Priority order:
1. **Error handling** — what happens with bad inputs, failures, nulls
2. **Boundary conditions** — empty arrays, zero, max values, single items
3. **Core business logic** — the main thing the code does
4. **Integration points** — where two systems meet

Skip: trivial getters/setters, framework boilerplate, code that's literally just `return x`

## Python (pytest)

```python
# test_module.py
import pytest
from mymodule import calculate_discount, UserService

class TestCalculateDiscount:
    def test_standard_discount_applied(self):
        assert calculate_discount(100, 0.1) == 90.0

    def test_zero_discount_returns_original_price(self):
        assert calculate_discount(100, 0) == 100.0

    def test_negative_price_raises_value_error(self):
        with pytest.raises(ValueError, match="price must be positive"):
            calculate_discount(-10, 0.1)

    def test_discount_over_100_percent_raises(self):
        with pytest.raises(ValueError):
            calculate_discount(100, 1.5)

    @pytest.mark.parametrize("price,rate,expected", [
        (200, 0.5, 100),
        (50,  0.2, 40),
        (0,   0.1, 0),
    ])
    def test_various_combinations(self, price, rate, expected):
        assert calculate_discount(price, rate) == expected


# Mocking external dependencies
from unittest.mock import patch, MagicMock

class TestUserService:
    @patch('mymodule.send_email')
    def test_welcome_email_sent_on_register(self, mock_send):
        svc = UserService()
        svc.register('test@example.com')
        mock_send.assert_called_once_with('test@example.com', subject='Welcome')
```

## JavaScript / TypeScript (Jest or Vitest)

```typescript
// module.test.ts
import { calculateDiscount, UserService } from './module';
import { vi } from 'vitest'; // or jest

describe('calculateDiscount', () => {
  it('applies standard discount', () => {
    expect(calculateDiscount(100, 0.1)).toBe(90);
  });

  it('throws on negative price', () => {
    expect(() => calculateDiscount(-10, 0.1)).toThrow('price must be positive');
  });

  it.each([
    [200, 0.5, 100],
    [50,  0.2, 40],
  ])('price=%i rate=%f → %i', (price, rate, expected) => {
    expect(calculateDiscount(price, rate)).toBe(expected);
  });
});

describe('UserService', () => {
  it('sends welcome email on register', async () => {
    const mockSend = vi.fn().mockResolvedValue(undefined);
    const svc = new UserService({ sendEmail: mockSend });
    await svc.register('test@example.com');
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com' })
    );
  });
});
```

## Naming Convention

```
test_[unit]_[condition]_[expected_result]
test_discount_negative_price_raises_value_error  ✓
test_discount_works  ✗  (too vague — what condition? what result?)
```

## Key Rules

- One assertion per test where possible — failing tests should be self-explaining
- Test behaviour, not implementation — don't test that `_internal_helper()` was called
- Always test error paths — most bugs hide there
- Use fixtures/factories for complex setup — don't repeat object construction
- If testing is hard, that's a code smell — the code probably needs to be split up
