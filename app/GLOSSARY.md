# App — Context Glossary

The app is the section-by-section resume builder: the user answers simple questions on one builder page per section, the answers accumulate in a per-session User record, and the resume page renders and exports the result. Use these terms exactly; prefer them over generic synonyms.

## Builder

**Section**:
One step of the resume builder: Info, Experience, Education, Skills, Summary. Same meaning as the backend's Section.
_Avoid_: step, stage, part

**Builder page**:
The page where the user answers the questions for one Section. The builder pages are the only place the user edits resume content.
_Avoid_: form page, wizard step

**User**:
The per-session record of everything the user has answered so far, written by the builder pages and read by the Outline.
_Avoid_: profile, session data, resume data

**Draft**:
An entry for a Section the user is still answering, not yet part of the User.
_Avoid_: queued entry, pending entry, work in progress

**Start over**:
The user's action that discards the User and every Draft and returns to the beginning of the builder.
_Avoid_: reset, clear, new resume

**Step**:
A Builder page's position in the fixed order the builder walks from Info to the Preview.
_Avoid_: stage, screen, wizard step

**Hub page**:
A page that lists a Section's entries and continues to the next Section: the experience summary, the education summary, and finish up.
_Avoid_: summary page, overview, list page

**Revisit**:
Returning from a Hub page to one Builder page to change an answer, then coming straight back to where the user left.
_Avoid_: resubmit, return URL, edit flow

**Suggestion**:
An example the generator offers beside a Builder page for one Section; it becomes resume content only when the user picks it.
_Avoid_: example, recommendation, AI result

**Suggestion failure**:
Why a Builder page could not offer Suggestions: unavailable in the user's region, no connection, or the generator failing. The user can always still write their own answer, and can retry unless the region rules it out.
_Avoid_: suggestion error, fallback, unavailable

**Field error**:
A validation message attached to one answer on a Builder page.
_Avoid_: input error, validation error

**Form error**:
A message about the submission as a whole, such as the answers not being saved, rather than any one answer.
_Avoid_: global error, page error

## Resume

**Resume**:
The document assembled from the User's Section answers.
_Avoid_: CV, output, document

**Outline**:
The ordered list of Blocks derived from the User. The single description of the Resume that every Renderer consumes.
_Avoid_: block list, document model, layout

**Block**:
One entry of the Outline: a semantic kind (person name, contact line, section title, job heading, date line, paragraph, bullet, spacer) and its text. Blocks carry meaning, never styling.
_Avoid_: node, element, line

**Renderer**:
Anything that turns the Outline into a surface: the Preview, the PDF Export, the DOCX Export.
_Avoid_: formatter, generator, exporter

**Preview**:
The read-only on-screen rendering of the Outline on the resume page, with a link from each Section back to its Builder page.
_Avoid_: editor, resume editor, rich-text editor

**Export**:
A PDF or DOCX rendering of the Outline, produced on demand when the user asks for it.
_Avoid_: download, generate

## API

**API client**:
The one browser module through which every builder page talks to the Worker's `/api/*` routes: three generators, error telemetry, issue reports. It returns results, never throws, and can be aborted on navigation.
_Avoid_: fetcher, proxy, resource route, service
