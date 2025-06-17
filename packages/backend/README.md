# @scc/backend

This package contains the backend services for the Second Chance Center (SCC) monorepo. Built on **Cloudflare Workers** and powered by **Bun**, this backend provides the robust and scalable APIs necessary for the frontend application to deliver its impactful features, including the AI-assisted resume generation.

Our backend leverages the power of Bun for rapid development and deployment, ensuring high performance and efficiency for all our services.

## Key Technologies

*   **Cloudflare Workers:** For serverless, edge-deployed functions offering low latency and global scale.
*   **Bun:** The JavaScript runtime, package manager, and bundler for a fast development cycle.
*   **Hono:** A small, fast, and scalable web framework for Cloudflare Workers.
*   **AI SDK (Google):** Powers intelligent features, such as resume content suggestions or optimization.
*   **Zod:** For robust schema validation of API inputs.

## Getting Started

To set up and run the `@scc/backend` locally or deploy it, follow these steps.

### Prerequisites

*   **Bun:** Ensure Bun is installed on your system. You can install it from [bun.sh](https://bun.sh).
*   **Cloudflare Account:** A Cloudflare account is required for deployment and using `wrangler`. Make sure you've logged in with `wrangler login`.

### 1. Install Dependencies

From the root of the SCC monorepo, install all dependencies:

```bash
bun install
```

This command will install all necessary packages for `@scc/backend` along with other monorepo packages.

### 2. Environment Variables

The backend requires specific environment variables for local development, such as API keys for the AI services.

Create a `.dev.vars` file in the root of the `@scc/backend` directory based on the provided `.dev.vars.example`:

```bash
cp .dev.vars.example .dev.vars
```

Edit the `.dev.vars` file and populate it with your actual API keys and configuration values. **Do not commit this file to version control.**

### 3. Run Locally (Development)

To start the backend in development mode with hot-reloading:

```bash
bun run dev
```

This command uses `wrangler dev --local` to run the Cloudflare Worker locally, simulating the Cloudflare Workers environment. The API will typically be available at `http://localhost:8787`.

### 4. Deploy to Cloudflare Workers

Once you are ready to deploy your backend to the Cloudflare Workers edge network:

```bash
bun run deploy
```

This command uses `wrangler deploy --minify` to build, minify, and publish your Worker. You will need to have configured your `wrangler.toml` file with your Cloudflare account details (e.g., `account_id`) and potentially a `route` or `workers_dev` for deployment.

### 5. Type Checking

To perform a type check on the backend codebase:

```bash
bun run typecheck
```

*Note: The `typecheck` script is inherited from the monorepo's top-level configuration or can be added to this package's `scripts` if needed.*

## Project Goals

The `@scc/backend` is crucial for:

*   **Secure API Endpoints:** Providing validated and secure APIs for the frontend.
*   **AI Integration:** Orchestrating calls to AI models for intelligent resume content generation and suggestions.
*   **Scalability:** Leveraging Cloudflare Workers for a globally distributed and highly scalable infrastructure.
*   **Performance:** Ensuring fast response times for a smooth user experience, especially during resume generation.

---
