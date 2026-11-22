# Secure Note-Taking Application — Backend REST API

A production-ready, highly optimized RESTful API built with Node.js, Express, TypeScript, and MongoDB. Engineered specifically to demonstrate disciplined database indexing, role-based access control (RBAC), and high-performance MongoDB aggregation pipelines.

---

## Live Deployment & Health Status

- **Live API Endpoint:** [https://secure-note-taking-application-backend-3muw.onrender.com](https://secure-note-taking-application-backend-3muw.onrender.com)
- **Health Check:** [https://secure-note-taking-application-backend-3muw.onrender.com/api/health](https://secure-note-taking-application-backend-3muw.onrender.com/api/health)
- **Cloud Database:** Hosted on MongoDB Atlas (M0 Cluster) with active replica set support.

### Pre-Configured Test Accounts

| Account | Email | Password | Role | Scope |
|---|---|---|---|---|
| **System Admin** | `admin@example.com` | `AdminPassword123!` | `admin` | Full platform management, user administration, global audit, reports |
| **User 1 (Alice)** | `user1@example.com` | `UserPassword123!` | `user` | Personal private notes CRUD, community posts |
| **User 2 (Bob)** | `user2@example.com` | `UserPassword123!` | `user` | Isolated private notes, community posts |

---

## 1. Technical Stack

| Concern | Technology | Justification |
|---|---|---|
| **Runtime** | Node.js (v20+) & TypeScript | Static type safety, ES2022 target, robust ecosystem |
| **HTTP Framework** | Express 4 | Lightweight, extensible middleware architecture |
| **Database** | MongoDB (v7.0) via Mongoose | Document database with native aggregation pipeline capabilities |
| **Authentication** | JWT (`jsonwebtoken`) | Stateless HS256 authentication with 1-hour expiration |
| **Password Security** | `bcrypt` | Adaptive password hashing with cost factor 12 |
| **Input Validation** | `zod` | Runtime boundary schema validation for bodies, params, and query strings |
| **Security Headers** | `helmet`, `cors`, `express-rate-limit` | OWASP security baseline, brute-force throttling on auth endpoints |

---

## 2. API Specification & Endpoints

All API endpoints are mounted under `/api`. Authenticated endpoints require an `Authorization: Bearer <token>` header.

### Endpoints Matrix

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/` | Public | Service discovery, metadata, and status overview. |
| `GET` | `/api/health` | Public | Health check and server timestamp. |
| `POST` | `/api/auth/register` | Public | Register new user (defaults to `user` role; interests supported). |
| `POST` | `/api/auth/login` | Public | Authenticates credentials, returns JWT (rate limited: 10 req/15m). |
| `GET` | `/api/users/me` | Authenticated | Fetches profile of currently authenticated user. |
| `GET` | `/api/posts` | Public | Lists community posts with cursor pagination (`_id: -1`). |
| `POST` | `/api/posts` | Authenticated | Publishes a post authored by the authenticated user. |
| `GET` | `/api/users/:id/posts` | Public | **Scenario 2:** Retrieves user profile and recent posts via `$lookup`. |
| `POST` | `/api/notes` | Authenticated | Creates a private personal note. |
| `GET` | `/api/notes?limit=&after=` | Authenticated | Lists personal notes with cursor pagination (`owner: 1, _id: -1`). |
| `GET` | `/api/notes/:id` | Owner / Admin | Retrieves single note. Non-owners receive 404 (prevents ID enumeration). |
| `PATCH` | `/api/notes/:id` | Owner only | Updates personal note content. Non-owners receive 404. |
| `DELETE` | `/api/notes/:id` | Owner only | Deletes personal note. Non-owners receive 404. |
| `GET` | `/api/users?limit=&after=` | Admin only | Lists all users with cursor pagination. Uses default `_id_` index. |
| `POST` | `/api/users` | Admin only | Provisions accounts directly (can assign `role: 'admin'`). |
| `GET` | `/api/users/:id` | Admin only | Retrieves user profile by ID. |
| `PATCH` | `/api/users/:id` | Admin only | Modifies user attributes (name, role, email, interests, password). |
| `DELETE` | `/api/users/:id` | Admin only | Atomically cascade deletes user, notes, and posts. |
| `GET` | `/api/admin/notes?owner=&limit=&after=` | Admin only | Platform-wide notes audit with optional owner filter. |
| `GET` | `/api/reports/users-by-interests?interest=&page=&limit=` | Admin only | **Scenario 1:** Groups users by interest via single `$facet` pipeline. |

---

## 3. Database Indexing Strategy & Performance Engineering

> **Core Engineering Discipline:** Purpose-driven indexing. Redundant indexes waste memory and introduce unnecessary write amplification. Every index in this project was created to directly support operational queries and eliminate in-memory sorting.

### 3.1 The 4 Explicit Indexes
All indexes are declared at the schema level using `schema.index()`:

| # | Collection | Index Specification | Properties | Primary Queries Supported |
|---|---|---|---|---|
| **1** | `users` | `{ email: 1 }` | `unique: true` | Login lookups (`User.findOne({ email })`) and email uniqueness checks |
| **2** | `users` | `{ interests: 1 }` | Multikey | Scenario 1 filtered aggregation (`$match` on interests before `$unwind`) |
| **3** | `notes` | `{ owner: 1, _id: -1 }` | Compound | User notes listing (newest-first cursor sort), admin notes by owner, cascade deletion |
| **4** | `posts` | `{ author: 1, _id: -1 }` | Compound | Scenario 2 `$lookup` join + sort, community posts, user cascade deletion |

### 3.2 Elimination of Redundant Indexes

1. **The ObjectId Timestamp Pattern (Eliminating `createdAt` Indexes):**
   - MongoDB `ObjectId`s naturally contain a 4-byte timestamp of document creation.
   - Sorting by `_id: -1` produces chronological descending ordering ("newest first") without requiring an extra `{ createdAt: -1 }` index.
   - Cursor pagination (`{ _id: { $lt: cursor } }`) operates directly over `_id`, saving index storage across `notes`, `posts`, and `users`.

2. **Reusing Default Primary Key Indexes (`_id_`):**
   - **Admin User List (`GET /api/users`):** Reuses the default `_id_` index for descending scans.
   - **Admin Unfiltered Notes (`GET /api/admin/notes`):** Reuses the default `_id_` index.
   - **Admin Filtered Notes (`GET /api/admin/notes?owner=<id>`):** Matches Compound Index #3 (`{ owner: 1, _id: -1 }`).

3. **Intentionally Unindexed Fields:**
   - `role`: Evaluated in-memory from authenticated JWT claims (`req.user.role === 'admin'`).
   - `name`, `title`: No text or wildcard search requirements exist in the API specification.

---

## 4. Aggregation Pipeline Architecture

### Scenario 1: Group Users by Interests (Single Pipeline)
- **Constraint:** Executed in exactly one `User.aggregate()` call without secondary queries for totals.
- **Pipeline Stages:**
  ```text
  [$match (if filtered)] -> $unwind ("$interests") -> $group (_id: "$interests", count: {$sum: 1}, userIds: {$push: "$_id"}) -> $sort (count: -1, _id: 1) -> $facet (paginated data + total groups count)
  ```
- **Performance Characteristics:**
  - When filtered (`?interest=chess`), the leading `$match` engages multikey Index #2 (`{ interests: 1 }`), filtering candidate documents before `$unwind`.
  - When unfiltered, grouping an entire collection by an unwound array inherently requires scanning user documents (`COLLSCAN`). The pipeline uses `$facet` to compute total interest counts and paginated items in a single server-side pass.

### Scenario 2: User Posts Join (`$lookup` Sub-Pipeline)
- **Constraint:** Executed in a single aggregation pipeline using a correlated `$lookup`.
- **Pipeline Implementation:**
  ```javascript
  User.aggregate([
    { $match: { _id: targetUserId } },
    {
      $lookup: {
        from: 'posts',
        let: { authorId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$author', '$$authorId'] } } },
          { $sort: { _id: -1 } },
          { $limit: 3 }
        ],
        as: 'recentPosts'
      }
    }
  ])
  ```
- **Performance Characteristics:**
  - Outer user match leverages the primary key index `_id_` (`IDHACK`).
  - Inner `$lookup` join and sort are completely covered by compound Index #4 (`{ author: 1, _id: -1 }`), eliminating in-memory sorting (`SORT` stage bypassed).

---

## 5. Empirical Verification (`explain('executionStats')`)

To evaluate query plans against a production-scale dataset:

```bash
npm run seed:data      # Inserts 10,000 documents (users, notes, posts)
npm run verify:explain # Analyzes execution stats across all 9 core queries
```

### Verified Execution Stats Matrix (10,000 Documents)

| Operation | Index Used | Query Plan Stages | Docs Examined | In-Memory Sort (`SORT`)? |
|---|---|---|---|---|
| **Login Lookup** | `email_1` (Index #1) | `FETCH -> IXSCAN` | 1 | No |
| **Profile by ID** | `_id_` (Default PK) | `IDHACK` | 1 | No |
| **Admin List Users** | `_id_` (Default PK) | `LIMIT -> FETCH -> IXSCAN` | 20 (limit: 20) | **No (Bypassed)** |
| **User List Notes** | `owner_1__id_-1` (Index #3) | `LIMIT -> FETCH -> IXSCAN` | 20 (limit: 20) | **No (Bypassed)** |
| **Admin List All Notes** | `_id_` (Default PK) | `LIMIT -> FETCH -> IXSCAN` | 20 (limit: 20) | **No (Bypassed)** |
| **Admin Notes by Owner** | `owner_1__id_-1` (Index #3) | `FETCH -> IXSCAN` | Owner's notes | **No (Bypassed)** |
| **Scenario 1 Filtered** | `interests_1` (Index #2) | `IXSCAN` | Filtered matches | No |
| **Scenario 1 Unfiltered** | None | `COLLSCAN` | Entire collection | Expected for full aggregation |
| **Scenario 2 ($lookup)** | `_id_` & `author_1__id_-1` | `IXSCAN` (both stages) | 1 user + 3 posts | **No (Bypassed)** |

---

## 6. Local Setup & Quickstart

### Prerequisites
- Node.js $\ge$ 18.x
- MongoDB $\ge$ 5.0 (Local instance, Docker, or MongoDB Atlas)

### 1. Installation
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```
Default configuration:
```env
PORT=3005
MONGO_URI=mongodb://localhost:27017/secure_notes
JWT_SECRET=supersecretlongjwtkeythatisatleast32characterslong
CORS_ORIGIN=http://localhost:5174
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=AdminPassword123!
```

### 3. Seed Database & Run
```bash
npm run seed:demo  # Seeds admin and demo users (Alice and Bob) with notes and posts
npm run dev        # Starts live reload development server
```

The server will be accessible at **`http://localhost:3005`**.
