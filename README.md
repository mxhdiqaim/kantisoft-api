# Store POS API

A modern, multi-tenant RESTful API for store (restaurant) Point-of-Sale (POS) systems.
Supports seamless onboarding, store and branch management, user roles, menu items/products, orders, and robust activity logging.

---

## Features

- **Multi-Tenancy:** Each store is isolated with its own users, menu, and orders.
- **Role-Based Access:** Manager, Admin, User, and Guest roles with fine-grained permissions.
- **Self-Service Onboarding:** Anyone can register, create a store, and start managing their business.
- **Branch Support:** Stores can have branches (child stores) linked to a parent.
- **Menu/Products Management:** CRUD for menu items, with per-store isolation.
- **Order Management:** Create, update, and track orders with payment and status.
- **Activity Logging:** All critical actions are logged for auditing and dashboarding.
- **Rate Limiting:** Protects the API from abuse and accidental overload.
- **Secure Authentication:** JWT-based authentication with password hashing.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/) database

### Installation

```bash
pnpm install
```

### Database Setup

1. Create a PostgreSQL database.
2. Configure your environment variables in a `.env` file (see `.env.example` if available):

    ```bash
    DB_HOST=some_value
    DB_PORT=some_value
    DB_USER=some_value
    DB_PASSWORD=some_value
    DB_NAME=some_value

    NODE_ENV=development
    PORT=some_value
    JWT_SECRET=some_value
    SESSION_SECRET=some_value
    ```

3. Generate Migrations:

    ```bash
    pnpm run generate
    ```

4. Run migrations:

    ```bash
    pnpm run migrate
    ```

5. (Optional) Seed the database with an initial manager:

    ```bash
    pnpm run seed
    ```

### Running the Server

```bash
pnpm dev
```

The API will be available at `http://localhost:{PORT}` (or your configured port).

---

## API Overview

### Authentication

- `POST /api/register` — Register a new manager and store
- `POST /api/login` — Login and receive a JWT
- `POST /api/logout` — Logout (JWT required)

### Users

- `GET /users` — List users (Manager/Admin)
- `POST /users/create` — Create user (Manager/Admin)
- `PATCH /users/:id` — Update user
- `DELETE /users/:id` — Delete user (soft delete)
- `PATCH /users/update-password` — Change password

### Stores

- `GET /stores` — List stores/branches
- `POST /stores` — Create branch
- `PATCH /stores/:id` — Update store
- `DELETE /stores/:id` — Delete store

### Menu Items/Products

- `GET /menu-items` — List menu items
- `POST /menu-items/create` — Add menu item
- `PATCH /menu-items/:id` — Update menu item
- `DELETE /menu-items/:id` — Delete menu item

### Orders

- `GET /orders` — List orders
- `POST /orders/create` — Create order
- `PATCH /orders/:id` — Update order status
- `DELETE /orders/:id` — Delete order

### Activity Log

- `GET /activities` — View activity log (Manager: all, Admin: non-manager actions)

---

## Development Notes

- **Rate Limiting:** Configured globally to prevent abuse (see `src/server.ts`).
- **Activity Logging:** All critical actions are logged automatically (see `src/service/activity-logger.ts`).
- **Multi-Tenancy:** All queries are scoped by `storeId` for data isolation.

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

<!-- ---

## License

[MIT](LICENSE) -->

---

## Contact

For questions or support, please open an issue or contact me mxhdiqaim@proton.me

---
