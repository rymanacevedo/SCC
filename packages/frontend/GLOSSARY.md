# Frontend — Context Glossary

The frontend is the section-by-section resume builder: the user answers simple questions on one builder page per section, the answers accumulate in a per-session User record, and the resume page renders and exports the result. Use these terms exactly; prefer them over generic synonyms.

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
