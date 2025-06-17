# SCC (Second Chance Center) Monorepo

Welcome to the Second Chance Center (SCC) monorepo! This project stands at the intersection of cutting-edge development and profound social impact. Built with [Bun](https://bun.sh), a fast all-in-one JavaScript runtime, this monorepo showcases an efficient and modern development workflow.

Beyond its technical foundation, SCC addresses a critical societal need: empowering individuals transitioning from incarceration by providing them with the tools to quickly build professional resumes. Our goal is to streamline the resume creation process, allowing users to generate a high-quality, impactful resume in just **10 minutes**, thereby significantly enhancing their prospects for employment and successful reintegration.

## Project Structure

This monorepo is designed to host multiple packages, fostering a cohesive development environment for different parts of the SCC ecosystem.

Currently, the primary packages include:

*   `@scc/frontend`: The user-facing application where individuals can easily create their resumes.

## Getting Started

To get the SCC monorepo up and running on your local machine, follow these simple steps:

### 1. Install Dependencies

Navigate to the root of the monorepo and install all project dependencies using Bun:

```bash
bun install
```

This command will leverage Bun's incredibly fast package installation to set up all necessary packages across the monorepo.

### 2. Run the Frontend Application

To start the development server for the frontend, navigate into the `@scc/frontend` package and run the dev script:

```bash
cd packages/frontend # or wherever your frontend package is located if not directly in 'packages'
bun run dev
```

This will typically start the frontend application on `http://localhost:5173` (or another available port), where you can interact with the resume builder.

### 3. Build for Production

To create a production-ready build of the frontend application:

```bash
cd packages/frontend
bun run build
```

This command will compile and optimize the frontend assets, ready for deployment.

### 4. Type Checking

To perform a type check across the frontend codebase:

```bash
cd packages/frontend
bun run typecheck
```

## Why Bun?

We chose Bun for this monorepo for its exceptional performance and streamlined development experience. Bun provides:

*   **Blazing Fast Performance:** From installing dependencies to running scripts, Bun significantly reduces development time.
*   **All-in-One Runtime:** Bun acts as a JavaScript runtime, package manager, and bundler, simplifying the toolchain.
*   **Native TypeScript Support:** Seamlessly integrates with TypeScript for a more robust development process.

## Making an Impact

The SCC project is more than just code; it's a mission to provide a crucial "second chance." By enabling quick resume generation, we empower individuals to overcome significant barriers to employment, contributing directly to their rehabilitation and a more inclusive society.

## Contribution

We welcome contributions from the community! If you're interested in contributing to this impactful project, please refer to our `CONTRIBUTING.md` (if available) or reach out to the project maintainers.
