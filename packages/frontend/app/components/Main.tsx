import { memo, type ReactNode } from 'react';

function Main({ children }: { children: ReactNode }) {
  return <main className="max-w-4xl mx-auto">{children}</main>;
}

export default memo(Main);
