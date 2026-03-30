---
name: nextjs-patterns
description: Use when building Next.js applications. Covers App Router, server components, API routes, environment variables, data fetching, and deployment patterns.
---

# Next.js Patterns Skill

Build production-ready Next.js applications with App Router, server components, and modern patterns.

## When to Use

- Creating a new Next.js application
- Implementing server vs client components
- Building API routes
- Setting up authentication
- Optimizing for performance and SEO

## Project Structure

```
my-app/
├── app/                    # App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles
│   ├── (auth)/             # Route group (not in URL)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx      # Dashboard layout
│   │   ├── page.tsx        # /dashboard
│   │   ├── settings/
│   │   │   └── page.tsx    # /dashboard/settings
│   │   └── projects/
│   │       ├── page.tsx    # /dashboard/projects
│   │       └── [id]/
│   │           └── page.tsx # /dashboard/projects/:id
│   └── api/                # API routes
│       ├── auth/
│       │   └── route.ts
│       └── users/
│           └── route.ts
├── components/
│   ├── ui/                 # Reusable UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── modal.tsx
│   └── features/           # Feature-specific components
│       ├── project-card.tsx
│       └── user-nav.tsx
├── lib/
│   ├── db.ts               # Database client
│   ├── auth.ts             # Auth utilities
│   └── utils.ts            # Helper functions
├── hooks/                  # Custom hooks
│   ├── use-auth.ts
│   └── use-debounce.ts
├── types/                  # TypeScript types
│   └── index.ts
├── .env.local
├── next.config.js
└── tailwind.config.js
```

## Server vs Client Components

### Server Component (Default)

```tsx
// app/page.tsx
import { db } from '@/lib/db';

// Server component - runs on server only
export default async function HomePage() {
  // Direct database access
  const projects = await db.project.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <main>
      <h1>Latest Projects</h1>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>{project.name}</li>
        ))}
      </ul>
    </main>
  );
}
```

### Client Component

```tsx
// components/search-input.tsx
'use client';

import { useState } from 'react';

export function SearchInput() {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Searching for:', query);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      <button type="submit">Search</button>
    </form>
  );
}
```

### Mixed Pattern

```tsx
// app/dashboard/page.tsx
import { db } from '@/lib/db';
import { SearchInput } from '@/components/search-input';
import { ProjectList } from '@/components/project-list';

export default async function DashboardPage() {
  // Server-side data fetching
  const projects = await db.project.findMany();

  return (
    <div>
      <h1>Dashboard</h1>
      {/* Client component for interactivity */}
      <SearchInput />
      {/* Server component receives data as props */}
      <ProjectList projects={projects} />
    </div>
  );
}
```

```tsx
// components/project-list.tsx
'use client';

import { useState } from 'react';
import { Project } from '@/types';

interface ProjectListProps {
  projects: Project[];
}

export function ProjectList({ projects }: ProjectListProps) {
  const [filter, setFilter] = useState('');

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        placeholder="Filter projects..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul>
        {filtered.map((project) => (
          <li key={project.id}>{project.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Data Fetching Patterns

### Parallel Data Fetching

```tsx
// app/page.tsx
import { db } from '@/lib/db';
import { Suspense } from 'react';

async function getProjects() {
  return db.project.findMany();
}

async function getUsers() {
  return db.user.findMany();
}

export default async function HomePage() {
  // Parallel fetching
  const [projects, users] = await Promise.all([
    getProjects(),
    getUsers(),
  ]);

  return (
    <div>
      <h1>Projects: {projects.length}</h1>
      <h1>Users: {users.length}</h1>
    </div>
  );
}
```

### Sequential Data Fetching

```tsx
// app/dashboard/stats/page.tsx
import { db } from '@/lib/db';

export default async function StatsPage() {
  // Sequential - second query depends on first
  const user = await db.user.findFirst();
  if (!user) return <div>No user found</div>;

  const stats = await db.stats.findUnique({
    where: { userId: user.id },
  });

  return <div>Stats: {JSON.stringify(stats)}</div>;
}
```

### Streaming with Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';
import { Projects } from './projects';
import { Stats } from './stats';
import { LoadingSpinner } from '@/components/loading-spinner';

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<LoadingSpinner />}>
        <Projects />
      </Suspense>
      <Suspense fallback={<LoadingSpinner />}>
        <Stats />
      </Suspense>
    </div>
  );
}

// app/dashboard/projects.tsx
import { db } from '@/lib/db';

export async function Projects() {
  const projects = await db.project.findMany();
  return <div>{/* render projects */}</div>;
}
```

## API Routes (Route Handlers)

### GET Endpoint

```tsx
// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');

  const users = await db.user.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json(users);
}
```

### POST Endpoint

```tsx
// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = userSchema.parse(body);

    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: await hashPassword(data.password),
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Dynamic Route

```tsx
// app/api/users/[id]/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface RouteParams {
  params: { id: string };
}

export async function GET(request: Request, { params }: RouteParams) {
  const user = await db.user.findUnique({
    where: { id: parseInt(params.id) },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(request: Request, { params }: RouteParams) {
  const body = await request.json();
  
  const user = await db.user.update({
    where: { id: parseInt(params.id) },
    data: body,
  });

  return NextResponse.json(user);
}

export async function DELETE(request: Request, { params }: RouteParams) {
  await db.user.delete({
    where: { id: parseInt(params.id) },
  });

  return NextResponse.json(null, { status: 204 });
}
```

## Environment Variables

```bash
# .env.local
DATABASE_URL="postgresql://localhost:5432/myapp"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
AUTH_SECRET="your-secret-key"

# .env.production
DATABASE_URL="postgresql://prod-server:5432/myapp"
NEXT_PUBLIC_API_URL="https://api.example.com"
```

```ts
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
});

const env = envSchema.parse(process.env);

export { env };
```

## Authentication Pattern

```tsx
// lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from './db';
import { compare } from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid credentials');
        }

        const isCorrectPassword = await compare(
          credentials.password,
          user.passwordHash
        );

        if (!isCorrectPassword) {
          throw new Error('Invalid credentials');
        }

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};
```

## Metadata and SEO

```tsx
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My App',
  description: 'The best app ever',
  openGraph: {
    title: 'My App',
    description: 'The best app ever',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/blog/[slug]/page.tsx
import { Metadata } from 'next';
import { db } from '@/lib/db';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await db.post.findUnique({
    where: { slug: params.slug },
  });

  return {
    title: post?.title,
    description: post?.excerpt,
  };
}

export default async function BlogPost({ params }: PageProps) {
  const post = await db.post.findUnique({
    where: { slug: params.slug },
  });

  return <article>{post?.content}</article>;
}
```

## Checklist

- [ ] App Router structure in place
- [ ] Server components by default
- [ ] Client components marked with 'use client'
- [ ] API routes for backend logic
- [ ] Environment variables validated
- [ ] Authentication configured
- [ ] Metadata for SEO
- [ ] Loading states with Suspense
