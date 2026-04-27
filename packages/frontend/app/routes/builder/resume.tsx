import { data, useLoaderData } from 'react-router';

export { RouteErrorBoundary as ErrorBoundary } from '../../components/ErrorBoundaryContent';

import Editor from '../../components/Editor';
import { getUser, type User } from '../../utils/user';

export function clientLoader() {
  const user = getUser();
  return data(user);
}

export default function Resume() {
  const user = useLoaderData<User>();
  return <Editor user={user} />;
}
