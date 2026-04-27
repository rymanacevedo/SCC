# @scc/frontend - SCC Resume Builder

This package contains the user-facing application for the Second Chance Center (SCC) monorepo. It is the core frontend to build professional resumes.

Built with **React 19**, **Vite**, **Bun**, and **TailwindCSS**.

## Key Features

*   **Rapid Resume Generation:** Intuitive interface designed for quick and guided resume creation.
*   **AI-Assisted Content (Future/Backend Integration):** Seamlessly integrates with the `@scc/backend` for intelligent suggestions and content optimization (once backend is fully integrated).
*   **Live Previews:** See your resume take shape in real-time.
*   **Export Options:** Generate professional-looking resumes in various formats (e.g., DOCX).

## Technologies Used
*   **Lexical:** A powerful and extensible JavaScript web text editor framework, used for rich text editing capabilities.
*   **TailwindCSS:** A utility-first CSS framework for rapid and consistent styling.
*   **Zod:** For robust client-side form validation.
*   **`docx` & `file-saver`:** For generating and downloading resumes as Word documents.

## Getting Started

To get the `@scc/frontend` application running on your local machine:

### Prerequisites

*   **Bun:** Ensure Bun is installed on your system. You can install it from [bun.sh](https://bun.sh).

### 1. Install Dependencies

From the root of the SCC monorepo, install all project dependencies. This will also install dependencies for `@scc/frontend`:

```bash
bun install
```

### 2. Development

To start the development server with hot-module replacement (HMR):

```bash
cd packages/frontend # Adjust path if your frontend package is located elsewhere
bun run dev
```

Your application will typically be available at `http://localhost:5173`. Any changes you make to the code will instantly reflect in your browser.

### 3. Building for Production

To create an optimized production build of the frontend application:

```bash
cd packages/frontend
bun run build
```

This command will compile and optimize all assets, ready for deployment.

### 4. Local Production Preview

To preview the production build locally:

```bash
cd packages/frontend
bun run preview
```

This will serve the optimized build, allowing you to test it before deployment.

### 5. Type Checking

To perform a type check on the frontend codebase:

```bash
cd packages/frontend
bun run typecheck
```

## Deployment

Since this is a frontend application, the `bun run build` command generates static assets that can be deployed to any static site hosting service or served by a Node/Bun server.

The output of `bun run build` will be found in the `dist/` directory within the `@scc/frontend` package.
