---
name: api-design
description: Use when designing REST APIs — defining endpoints, request/response shapes, error codes, and OpenAPI specifications. Ensures consistent, well-documented APIs.
---

# API Design Skill

Design RESTful APIs with consistent patterns, proper status codes, and OpenAPI documentation.

## When to Use

- Creating a new API from scratch
- Adding endpoints to an existing API
- Documenting API for frontend teams
- Reviewing API design for consistency
- Generating API client libraries

## REST API Principles

### Resource-Based URLs

```
✓ Good:
GET    /users
GET    /users/123
POST   /users
PUT    /users/123
DELETE /users/123

✗ Bad (RPC-style):
GET    /getUsers
POST   /createUser
POST   /deleteUser?id=123
```

### HTTP Methods

| Method | Purpose | Idempotent | Body |
|--------|---------|------------|------|
| GET | Retrieve resource | Yes | No |
| POST | Create resource | No | Yes |
| PUT | Replace resource | Yes | Yes |
| PATCH | Update resource | No | Yes |
| DELETE | Delete resource | Yes | No |

### Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input, validation errors |
| 401 | Unauthorized | Missing or invalid auth |
| 403 | Forbidden | Authenticated but no permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource, version conflict |
| 422 | Unprocessable Entity | Validation errors (common alternative to 400) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server bug |

## Request/Response Patterns

### Standard Response Shape

```json
{
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Collection Response with Pagination

```json
{
  "data": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20,
    "total_pages": 5,
    "next_page": 2,
    "prev_page": null
  }
}
```

### Error Response Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "details": [
      {
        "field": "email",
        "message": "Must be a valid email address"
      }
    ]
  }
}
```

## Endpoint Design Examples

### CRUD Endpoints

```
GET    /users              — List users (with pagination)
GET    /users/:id          — Get single user
POST   /users              — Create user
PUT    /users/:id          — Replace user
PATCH  /users/:id          — Update user fields
DELETE /users/:id          — Delete user
```

### Nested Resources

```
GET    /users/123/orders        — Get user's orders
POST   /users/123/orders        — Create order for user
GET    /users/123/orders/456    — Get specific order
```

### Actions (when REST isn't enough)

```
POST   /users/123/password-reset    — Send password reset email
POST   /orders/123/cancel           — Cancel an order
POST   /files/123/download          — Generate download URL
```

## OpenAPI Specification

```yaml
openapi: 3.0.3
info:
  title: E-commerce API
  version: 1.0.0
  description: API for managing products and orders

servers:
  - url: https://api.example.com/v1

paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: per_page
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
    
    post:
      summary: Create user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /users/{id}:
    get:
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        email:
          type: string
          format: email
        name:
          type: string
        created_at:
          type: string
          format: date-time
    
    CreateUserRequest:
      type: object
      required:
        - email
        - name
      properties:
        email:
          type: string
          format: email
        name:
          type: string
        password:
          type: string
          minLength: 8
    
    PaginationMeta:
      type: object
      properties:
        total:
          type: integer
        page:
          type: integer
        per_page:
          type: integer
        total_pages:
          type: integer
    
    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: array
              items:
                type: object
                properties:
                  field:
                    type: string
                  message:
                    type: string
```

## API Design Checklist

- [ ] URLs are resource-based (nouns, not verbs)
- [ ] HTTP methods used correctly
- [ ] Status codes are appropriate
- [ ] Error responses are consistent
- [ ] Pagination implemented for collections
- [ ] Filtering/sorting documented
- [ ] Authentication documented
- [ ] Rate limiting documented
- [ ] OpenAPI spec is complete
- [ ] Examples provided for all endpoints

## Versioning

**URL versioning (recommended):**
```
https://api.example.com/v1/users
https://api.example.com/v2/users
```

**Header versioning:**
```
Accept: application/vnd.example.v1+json
```

## Rate Limiting Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642234567
```
