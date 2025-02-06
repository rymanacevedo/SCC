import type {
  ClientActionFunctionArgs,
  ClientLoaderFunctionArgs,
} from 'react-router';

export async function clientAction({ request }: ClientActionFunctionArgs) {
  // get the items that were passed in the form
  //commit them to the session
  return {};
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  return Response.json({ ok: true });
}
