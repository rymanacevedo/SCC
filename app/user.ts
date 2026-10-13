import { z } from 'zod';
import type { Result } from '../shared/result.ts';
import {
  type Drafts,
  draftSchemas,
  type Section,
  sectionSchemas,
  type User,
} from '../shared/schemas/user.ts';
import { reportError } from './api.ts';

export type { Drafts, Section, User } from '../shared/schemas/user.ts';
export const STORAGE_KEY = 'scc:user';
export const BACKUP_KEY = 'scc:user:backup';
export const STORAGE_VERSION = 1;
export interface Envelope {
  version: number;
  timestamp: string;
  user: User;
  drafts: Drafts;
}
const envelopeSchema = z.object({
  version: z.number().int(),
  timestamp: z.iso.datetime(),
  user: z.record(z.string(), z.unknown()),
  drafts: z.record(z.string(), z.unknown()),
});
const fresh = (): Envelope => ({
  version: STORAGE_VERSION,
  timestamp: new Date().toISOString(),
  user: {},
  drafts: {},
});

export function createUserStorage(
  storage: () => Storage = () => window.sessionStorage,
  telemetry: (message: string) => void = (message) => {
    queueMicrotask(() => {
      void reportError({
        message,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      });
    });
  },
) {
  function save(envelope: Envelope): Result<Envelope> {
    try {
      const saved = {
        ...envelope,
        version: STORAGE_VERSION,
        timestamp: new Date().toISOString(),
      };
      storage().setItem(STORAGE_KEY, JSON.stringify(saved));
      return { ok: true, value: saved };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }
  function read(): Result<Envelope> {
    try {
      const raw = storage().getItem(STORAGE_KEY);
      if (raw === null) return { ok: true, value: fresh() };
      let parsed: z.infer<typeof envelopeSchema>;
      try {
        parsed = envelopeSchema.parse(JSON.parse(raw));
      } catch {
        // Back up before replacing: if either write fails, preserve the original.
        storage().setItem(BACKUP_KEY, raw);
        const result = save(fresh());
        if (result.ok)
          telemetry(
            'Stored envelope could not be parsed; started a fresh User.',
          );
        return result;
      }
      const value = fresh();
      value.timestamp = parsed.timestamp;
      let changed = parsed.version !== STORAGE_VERSION;
      for (const section of Object.keys(sectionSchemas) as Section[]) {
        if (parsed.user[section] === undefined) continue;
        const result = sectionSchemas[section].safeParse(parsed.user[section]);
        if (result.success)
          Object.assign(value.user, { [section]: result.data });
        else changed = true;
      }
      for (const section of Object.keys(draftSchemas) as (keyof Drafts)[]) {
        if (parsed.drafts[section] === undefined) continue;
        const result = draftSchemas[section].safeParse(parsed.drafts[section]);
        if (result.success)
          Object.assign(value.drafts, { [section]: result.data });
        else changed = true;
      }
      if (changed) {
        const saved = save(value);
        if (saved.ok)
          telemetry(
            'Stored envelope salvaged after validation or version change.',
          );
        return saved;
      }
      return { ok: true, value };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }
  function change(update: (value: Envelope) => void): Result<Envelope> {
    const current = read();
    if (!current.ok) return current;
    update(current.value);
    return save(current.value);
  }
  function write<K extends Section>(
    section: K,
    value: NonNullable<User[K]>,
  ): Result<Envelope> {
    const parsed = sectionSchemas[section].safeParse(value);
    if (!parsed.success) return { ok: false, error: 'validation' };
    return change((envelope) => {
      Object.assign(envelope.user, { [section]: parsed.data });
    });
  }
  function writeDraft<K extends keyof Drafts>(
    section: K,
    value: NonNullable<Drafts[K]>,
  ): Result<Envelope> {
    const parsed = draftSchemas[section].safeParse(value);
    if (!parsed.success) return { ok: false, error: 'validation' };
    return change((envelope) => {
      Object.assign(envelope.drafts, { [section]: parsed.data });
    });
  }
  /** Commit by identity and clear only this Section's Draft in the same write. */
  function writeEntry<K extends keyof Drafts>(
    section: K,
    entry: NonNullable<User[K]>[number],
  ): Result<Envelope> {
    const parsed = sectionSchemas[section].element.safeParse(entry);
    if (!parsed.success) return { ok: false, error: 'validation' };
    return change((envelope) => {
      const identity = (value: { jobId: string } | { educationId: string }) =>
        'jobId' in value ? value.jobId : value.educationId;
      const entries: (
        | NonNullable<User['experience']>[number]
        | NonNullable<User['education']>[number]
      )[] = [...(envelope.user[section] ?? [])];
      const index = entries.findIndex(
        (value) => identity(value) === identity(parsed.data),
      );
      if (index < 0) entries.push(parsed.data);
      else entries[index] = parsed.data;
      Object.assign(envelope.user, { [section]: entries });
      delete envelope.drafts[section];
    });
  }
  function seedDraft<K extends keyof Drafts>(
    section: K,
    id: string,
  ): Result<Envelope> {
    const current = read();
    if (!current.ok) return current;
    const entry = current.value.user[section]?.find(
      (value) => ('jobId' in value ? value.jobId : value.educationId) === id,
    );
    if (!entry) return { ok: false, error: 'not-found' };
    Object.assign(current.value.drafts, { [section]: entry });
    return save(current.value);
  }
  function clearDrafts(section?: keyof Drafts): Result<Envelope> {
    const current = read();
    if (!current.ok || Object.keys(current.value.drafts).length === 0)
      return current;
    const drafts = { ...current.value.drafts };
    if (section) delete drafts[section];
    else {
      delete drafts.experience;
      delete drafts.education;
    }
    return save({ ...current.value, drafts });
  }
  function startOver(): Result<void> {
    try {
      storage().removeItem(STORAGE_KEY);
      storage().removeItem(BACKUP_KEY);
      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: 'storage' };
    }
  }
  return {
    read,
    write,
    writeDraft,
    writeEntry,
    seedDraft,
    clearDrafts,
    startOver,
  };
}
export const userStorage = createUserStorage();
export type UserStorage = ReturnType<typeof createUserStorage>;

const escapePromptText = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
/** The only serializer for Generation requests derived from the stored User. */
export function serializePrompt(user: User): string | undefined {
  if (!user.experience?.length) return undefined;
  return user.experience
    .map(
      (job) =>
        `<job><jobTitle>${escapePromptText(job.jobTitle)}</jobTitle><employer>${escapePromptText(job.employer)}</employer><details>${(job.details ?? []).map((detail, i) => `<detail${i + 1}>${escapePromptText(detail)}</detail${i + 1}>`).join('')}</details></job>`,
    )
    .join('');
}
