// app/routes/builder.finish.tsx
import { redirect, useLoaderData } from 'react-router';
import { Form } from 'react-router';
import type { Route } from '../../../.react-router/types/app/+types/root';
import Button from '../../components/Button';
import Heading from '../../components/Heading';
import EditLink from '../../components/EditLink';
import { getUser, type User } from '../../utils/user';
import Main from '../../components/Main';
import { HeadingWithSubHeading } from '../../components/HeadingWithSubHeading';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    return redirect('/resume');
  } catch (error) {
    // Handle errors
  }
}

export function clientLoader() {
  const user = getUser();
  return user;
}

export default function Finish() {
  const user = useLoaderData<User>();
  return (
    <Main>
      <HeadingWithSubHeading
        firstHeading="Review Your Resume"
        secondHeading="Review and edit your information before finalizing your resume."
      />

      <div className="shadow rounded-lg overflow-hidden">
        {/* Personal Information Section */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <Heading
              text="Personal Information"
              level="h2"
              size="text-lg"
              classNames="font-semibold"
            />
            <EditLink to="/info" returnUrl="/finish-up" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Heading
                text="Name"
                level="h3"
                size="text-sm"
                color="dark:text-gray-400 text-gray-500"
              />
              <p className="font-medium">
                {user.info?.firstName} {user.info?.lastName}
              </p>
            </div>
            <div>
              <Heading
                text="Location"
                level="h3"
                size="text-sm"
                color="dark:text-gray-400 text-gray-500"
              />
              <p className="font-medium">
                {user.info?.city}, {user.info?.state} {user.info?.zipCode}
              </p>
            </div>
            <div>
              <Heading
                text="Phone"
                level="h3"
                size="text-sm"
                color="dark:text-gray-400 text-gray-500"
              />
              <p className="font-medium">{user.info?.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{user.info?.email}</p>
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <Heading
              text="Professional Summary"
              level="h2"
              size="text-lg"
              classNames="font-semibold"
            />
            <EditLink to="/summary" returnUrl="/finish-up" />
          </div>
          <p className="dark:text-gray-400 text-gray-600">
            {user.summary?.summary}
          </p>
        </div>

        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <Heading
              text="Job Experience"
              level="h2"
              size="text-lg"
              classNames="font-semibold"
            />

            <EditLink to="/experience-summary" returnUrl="/finish-up" />
          </div>
          <div className="p-1">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {user.experience?.map((job) => (
                <div key={job.jobId} className="py-4">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {job.jobTitle}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {job.startDate?.toLocaleDateString()} -{' '}
                      {job.currentlyEmployed
                        ? 'Present'
                        : job.endDate?.toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {job.employer} • {job.location}
                  </div>
                  {job.details && (
                    <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                      {job.details.map((detail, index) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Education Section */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <Heading
              text="Education"
              level="h2"
              size="text-lg"
              classNames="font-semibold"
            />
            <EditLink to="/education" returnUrl="/finish-up" />
          </div>
          <div className="space-y-3">
            <div>
              <Heading
                text="School"
                level="h3"
                size="text-sm"
                color="dark:text-gray-400 text-gray-500"
              />
              <p className="font-medium">{user.education?.schoolName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Heading
                  text="Degree"
                  level="h3"
                  size="text-sm"
                  color="dark:text-gray-400 text-gray-500"
                />
                <p className="font-medium">{user.education?.educationLevel}</p>
              </div>
              <div>
                <Heading
                  text="Field of Study"
                  level="h3"
                  size="text-sm"
                  color="dark:text-gray-400 text-gray-500"
                />
                <p className="font-medium">{user.education?.degree}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Skills Section */}
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <Heading
              text="Skills"
              level="h2"
              size="text-lg"
              classNames="font-semibold"
            />
            <EditLink to="/skills" returnUrl="/finish-up" />
          </div>
          <div className="flex flex-wrap gap-2">
            {user.skills?.expertRecommended?.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center px-3 py-1 rounded-full 
                    text-sm font-medium bg-blue-50 text-blue-700"
              >
                {skill}
              </span>
            ))}
            {user.skills?.other?.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center px-3 py-1 rounded-full 
                    text-sm font-medium bg-blue-50 text-blue-700"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-between">
        <Button
          text="Previous"
          type="secondary"
          action="button"
          callback={() => window.history.back()}
        />

        <Form method="post">
          <Button text="Preview Resume" action="submit" />
        </Form>
      </div>
    </Main>
  );
}
