import { memo } from 'react';
import { NavLink } from 'react-router';

interface EditLinkProps {
  to: string;
  returnUrl: string;
  jobId?: string;
}

function EditLink({ to, returnUrl, jobId }: EditLinkProps) {
  const addReturnUrl = (baseUrl: string, returnUrl: string) => {
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.append('returnUrl', encodeURIComponent(returnUrl));
    return url.pathname + url.search;
  };

  const createEditUrl = (path: string, returnUrl: string) => {
    return addReturnUrl(path, returnUrl);
  };
  const createExperienceEditUrl = (
    path: string,
    returnUrl: string,
    jobId?: string,
  ) => {
    const baseUrl = jobId ? `${path}?jobId=${encodeURIComponent(jobId)}` : path;
    return addReturnUrl(baseUrl, returnUrl);
  };

  const href = jobId
    ? createExperienceEditUrl(to, returnUrl, jobId)
    : createEditUrl(to, returnUrl);

  return (
    <NavLink to={href} className="text-sm text-blue-600 hover:text-blue-800">
      Edit
    </NavLink>
  );
}

export default memo(EditLink);
