import { type Handle, on } from 'remix/component';

/** Shared by finish-up and the Preview; only the explicit confirm submits. */
export function StartOver(handle: Handle<{ action: string }>) {
  let confirming = false;
  return () => (
    <div className="mt-8">
      {confirming ? (
        <form method="post" action={handle.props.action}>
          <p>Discard all your answers and Drafts? This cannot be undone.</p>
          <input type="hidden" name="intent" value="start-over" />
          <button type="submit" name="confirm" value="yes">
            Confirm Start over
          </button>
          <button
            type="button"
            mix={on('click', () => {
              confirming = false;
              void handle.update();
            })}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          mix={on('click', () => {
            confirming = true;
            void handle.update();
          })}
        >
          Start over
        </button>
      )}
    </div>
  );
}
