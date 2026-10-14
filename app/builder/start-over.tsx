import { type Handle, on } from 'remix/component';
import { Button } from '../ui/button.tsx';

/** Shared by finish-up and the Preview; only the explicit confirm submits. */
export function StartOver(handle: Handle<{ action: string }>) {
  let confirming = false;
  const toggle = (next: boolean) => () => {
    confirming = next;
    void handle.update();
  };
  return () => (
    <div className="mt-8 border-t pt-6">
      {confirming ? (
        <form method="post" action={handle.props.action} className="space-y-4">
          <p className="text-sm text-gray-700">
            Discard all your answers and Drafts? This cannot be undone.
          </p>
          <input type="hidden" name="intent" value="start-over" />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="dark" name="confirm" value="yes">
              Confirm Start over
            </Button>
            <Button variant="outline" mix={on('click', toggle(false))}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" mix={on('click', toggle(true))}>
          Start over
        </Button>
      )}
    </div>
  );
}
