# Event Booking API

A REST API built with NestJS where users sign up, browse events, and book seats. Admins create and manage events.

**Stack:** NestJS 11, TypeScript, MongoDB (Mongoose), JWT, bcrypt, class-validator, Swagger

## Setup

Prerequisites: Node.js 20+ and a running MongoDB instance.

```bash
npm install
cp .env.example .env      # then edit the values
npm run start:dev         # http://localhost:3000
```

Production build:

```bash
npm run build
npm run start:prod
```

**API docs (Swagger):** http://localhost:3000/api/docs. To call protected routes, log in, copy `accessToken`, and paste it into **Authorize**.

## Environment variables

| Variable         | Required | Default | Description                                             |
| ---------------- | -------- | ------- | ------------------------------------------------------- |
| `PORT`           | no       | `3000`  | HTTP port                                               |
| `MONGO_URI`      | yes      | –       | MongoDB connection string                               |
| `JWT_SECRET`     | yes      | –       | Secret used to sign JWTs                                |
| `JWT_EXPIRES_IN` | no       | `1d`    | Token lifetime (e.g. `1h`, `7d`)                        |
| `ADMIN_NAME`     | no       | `Admin` | Name for the seeded admin                               |
| `ADMIN_EMAIL`    | no*      | –       | Admin account created on startup if it doesn't exist    |
| `ADMIN_PASSWORD` | no*      | –       | Password for that admin                                 |

\* If either is missing, no admin is seeded and a warning is logged. The app refuses to start without `MONGO_URI` or `JWT_SECRET`.

## Endpoints

| Method | Path                | Access | Notes                                                    |
| ------ | ------------------- | ------ | -------------------------------------------------------- |
| POST   | `/auth/register`    | Public | `{ name, email, password }`, always creates `role=user` |
| POST   | `/auth/login`       | Public | `{ email, password }` → `{ accessToken }`                |
| GET    | `/events`           | Public | `?page=1&limit=10&search=rock&status=upcoming\|past`     |
| GET    | `/events/:id`       | Public | Includes `remainingSeats`                                |
| POST   | `/events`           | Admin  | `{ title, description, date, venue, totalSeats }`        |
| PATCH  | `/events/:id`       | Admin  | Any subset of the create fields                          |
| DELETE | `/events/:id`       | Admin  | Also deletes the event's bookings                        |
| POST   | `/events/:id/book`  | User   | `{ seats }` (1–5)                                        |
| GET    | `/bookings/me`      | User   | The caller's bookings (active + cancelled), newest first |
| DELETE | `/bookings/:id`     | Owner  | Cancels the booking and releases its seats               |

Protected routes need the header `Authorization: Bearer <accessToken>`.

### Response shape

Success:

```json
{ "success": true, "data": { "...": "..." } }
```

Error (every error, including validation errors):

```json
{ "statusCode": 400, "message": "Cannot book a past event", "timestamp": "2026-10-22T10:00:00.000Z", "path": "/events/.../book" }
```

For validation errors, `message` is an array of field errors.

`GET /events` returns `data: { items, total, page, limit, totalPages }`.

## Assumptions

- **Admins** are never created through the API. A single admin is seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on startup. `/auth/register` always creates a `user`, and any `role` field in the body is rejected.
- **Upcoming vs. past** compares the event `date` to the current time: `upcoming` means `date > now`, `past` means `date <= now`. Leaving out `status` returns all events. Results are sorted by `date` ascending.
- **Search** is a case-insensitive partial match on `title`.
- **`limit`** is capped at 100.
- **Cancelling** is a soft cancel: `status` becomes `cancelled` and the seats are released. After cancelling, the user can book the same event again. A user can't cancel a booking for an event that has already happened (400). A user who isn't the owner gets a 403.
- **Duplicate booking** means the user already has an *active* booking for the event (409). The check is also enforced by a partial unique index on `{ user, event }`.
- **Updating `totalSeats`** to a value below the seats already booked is rejected with a 400.
- **Deleting an event** also deletes all of its bookings.
- Admins can create events with past dates, for example to back-fill history. Past events can't be booked.

## Concurrency / overbooking

Seats are reserved with a single atomic `findOneAndUpdate` on the event. It only matches when `bookedSeats + seats <= totalSeats` and the event is in the future, and it increments `bookedSeats` in the same operation. Two users racing for the last seats can't both succeed. If the booking insert then fails (e.g. the same user submitted twice in parallel and hit the unique index), the reserved seats are released. Cancelling is also conditional on `status: active`, so a double cancel can't release seats twice. This approach doesn't need a replica set or transactions.

## What I'd improve with more time

- Unit tests for `BookingsService` and e2e tests (e.g. `mongodb-memory-server` + supertest), plus Docker Compose for the app and Mongo.
- Use a Mongo transaction (replica set) for reserving seats and creating the booking together, instead of the compensating update.
- Refresh tokens, rate limiting on `/auth/*`, and `helmet`.
- An admin endpoint to manage users and roles, and a way to list an event's attendees.
- Text index or Atlas Search for title search; the current regex scan won't scale to large collections.
- Swagger response schemas for the `{ success, data }` envelope.
