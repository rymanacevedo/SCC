import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyEvalEnvironment } from './env';

const evalDirectory = dirname(fileURLToPath(import.meta.url));
const backendDirectory = resolve(evalDirectory, '..');

await applyEvalEnvironment(backendDirectory);
