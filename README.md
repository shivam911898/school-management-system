# School Management System

A comprehensive, production-ready school management system built with Node.js, Express, and MongoDB. Features include user authentication (admin, teacher, student roles), attendance tracking, class and student management, notices, and a public-facing website.

## Key Features

- **Role-Based Access Control (RBAC)**: Secure endpoints for admin, teacher, and student roles.
- **Authentication**: JWT-based authentication with cookies.
- **Database**: MongoDB with Mongoose for data modeling.
- **API**: RESTful API for all core functionalities.
- **Frontend**: Static HTML/CSS/JS for admin, teacher, and student dashboards.
- **Security**: Includes `helmet`, `express-mongo-sanitize`, `express-rate-limit`, and `hpp`.
- **Logging**: Structured logging with `pino`.
- **Deployment**: Ready for deployment on platforms like Render and Docker.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- MongoDB (can be run locally via Docker)
- Docker & Docker Compose (for local database)

### Local Development

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd school-management-final
    ```

2.  **Create a `.env` file:**
    Copy the `.env.example` to `.env` and fill in the required environment variables.
    ```bash
    cp .env.example .env
    ```
    At a minimum, you need to set `JWT_SECRET`.

3.  **Install dependencies:**
    ```bash
    npm ci
    ```

4.  **Start the database:**
    If you have Docker installed, you can start a local MongoDB instance using the provided `docker-compose.yml`.
    ```bash
    docker-compose up -d
    ```

5.  **Run the application:**
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:5000` (or the `PORT` specified in your `.env`).

### Running with Docker

A `Dockerfile` and `docker-compose.local.yml` are provided for a full containerized setup.

1.  **Ensure your `.env` file is configured.** The `MONGO_URI` should point to the Docker service name: `mongodb://mongo:27017/school-management`.

2.  **Build and run the services:**
    ```bash
    docker-compose -f docker-compose.local.yml up --build
    ```

## Deployment

This application is ready to be deployed on various platforms.

### Render

The `render.yaml` file in the root of the repository allows for one-click deployment on [Render](https://render.com/).

1.  Create a new "Blueprint" service on Render and point it to your repository.
2.  Render will automatically detect the `render.yaml` file.
3.  Add a new MongoDB instance on Render.
4.  In your service settings, add the required environment variables (`MONGO_URI`, `JWT_SECRET`, etc.).

### Docker

1.  **Build the Docker image:**
    ```bash
    docker build -t school-management-app .
    ```

2.  **Run the container:**
    Make sure to provide the necessary environment variables.
    ```bash
    docker run -p 5000:5000 --env-file ./.env school-management-app
    ```

## Scripts

- `npm start`: Starts the server.
- `npm run dev`: Starts the server in development mode with `nodemon`.
- `npm run db:up`: Starts the MongoDB container.
- `npm run db:down`: Stops the MongoDB container.
- `npm test:rbac`: Runs a smoke test for role-based access control.
- `npm run password:reset`: A utility script to reset a user's password.
- `npm run verify:deploy`: A post-deployment verification script.
