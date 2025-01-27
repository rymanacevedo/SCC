// app/routes/builder.finish.tsx
import { redirect } from 'react-router';
import { Form } from 'react-router';
import { useState } from 'react';
import type { Route } from '../../../.react-router/types/app/+types/root';

export async function clientAction({ request }: Route.ClientActionArgs) {
  const formData = await request.formData();
  const data = Object.fromEntries(formData);

  try {
    return redirect('/builder/download');
  } catch (error) {
    // Handle errors
  }
}

export default function Finish() {
  const [editingSection, setEditingSection] = useState<string | null>(null);

  // This would be replaced with your actual data from previous steps
  const [resumeData, setResumeData] = useState({
    personal: {
      firstName: 'John',
      lastName: 'Doe',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      phone: '(555) 555-5555',
      email: 'john.doe@example.com',
    },
    summary: `Results-driven software developer with 5 years of experience building web applications. 
      Proficient in JavaScript, React, and Node.js. Strong problem-solving abilities and experience 
      working in agile environments.`,
    education: {
      schoolName: 'University of Example',
      degree: "Bachelor's Degree",
      fieldOfStudy: 'Computer Science',
      location: 'Boston, MA',
      graduationDate: '2022-05',
    },
    skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Python'],
  });

  const handleSectionEdit = (section: string) => {
    setEditingSection(section);
  };

  const handleSectionSave = (section: string, newData: any) => {
    setResumeData((prev) => ({
      ...prev,
      [section]: newData,
    }));
    setEditingSection(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Review Your Resume</h1>
        <p className="mt-2 text-sm text-gray-600">
          Review and edit your information before finalizing your resume.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Personal Information Section */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Personal Information
            </h2>
            <button
              onClick={() => handleSectionEdit('personal')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {editingSection === 'personal' ? 'Save' : 'Edit'}
            </button>
          </div>
          {editingSection === 'personal' ? (
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                value={resumeData.personal.firstName}
                onChange={(e) =>
                  setResumeData((prev) => ({
                    ...prev,
                    personal: { ...prev.personal, firstName: e.target.value },
                  }))
                }
                className="border rounded-md p-2"
                placeholder="First Name"
              />
              {/* Add other personal info fields */}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">
                  {resumeData.personal.firstName} {resumeData.personal.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium">
                  {resumeData.personal.city}, {resumeData.personal.state}{' '}
                  {resumeData.personal.zipCode}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{resumeData.personal.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{resumeData.personal.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Summary Section */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Professional Summary
            </h2>
            <button
              onClick={() => handleSectionEdit('summary')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {editingSection === 'summary' ? 'Save' : 'Edit'}
            </button>
          </div>
          {editingSection === 'summary' ? (
            <textarea
              value={resumeData.summary}
              onChange={(e) =>
                setResumeData((prev) => ({
                  ...prev,
                  summary: e.target.value,
                }))
              }
              className="w-full border rounded-md p-3"
              rows={4}
            />
          ) : (
            <p className="text-gray-700">{resumeData.summary}</p>
          )}
        </div>

        {/* Education Section */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Education</h2>
            <button
              onClick={() => handleSectionEdit('education')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {editingSection === 'education' ? 'Save' : 'Edit'}
            </button>
          </div>
          {editingSection === 'education' ? (
            <div className="space-y-4">
              <input
                type="text"
                value={resumeData.education.schoolName}
                onChange={(e) =>
                  setResumeData((prev) => ({
                    ...prev,
                    education: {
                      ...prev.education,
                      schoolName: e.target.value,
                    },
                  }))
                }
                className="w-full border rounded-md p-2"
                placeholder="School Name"
              />
              {/* Add other education fields */}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">School</p>
                <p className="font-medium">{resumeData.education.schoolName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Degree</p>
                  <p className="font-medium">{resumeData.education.degree}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Field of Study</p>
                  <p className="font-medium">
                    {resumeData.education.fieldOfStudy}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Skills Section */}
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Skills</h2>
            <button
              onClick={() => handleSectionEdit('skills')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {editingSection === 'skills' ? 'Save' : 'Edit'}
            </button>
          </div>
          {editingSection === 'skills' ? (
            <div className="space-y-2">
              {resumeData.skills.map((skill, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={skill}
                    onChange={(e) => {
                      const newSkills = [...resumeData.skills];
                      newSkills[index] = e.target.value;
                      setResumeData((prev) => ({ ...prev, skills: newSkills }));
                    }}
                    className="border rounded-md p-2"
                  />
                  <button
                    onClick={() => {
                      const newSkills = resumeData.skills.filter(
                        (_, i) => i !== index,
                      );
                      setResumeData((prev) => ({ ...prev, skills: newSkills }));
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setResumeData((prev) => ({
                    ...prev,
                    skills: [...prev.skills, ''],
                  }))
                }
                className="text-blue-600 hover:text-blue-800"
              >
                Add Skill
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {resumeData.skills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full 
                    text-sm font-medium bg-blue-50 text-blue-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex justify-center rounded-md border border-gray-300 
            bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm 
            hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 
            focus:ring-offset-2"
        >
          Previous
        </button>
        <Form method="post">
          <button
            type="submit"
            className="inline-flex justify-center rounded-md border border-transparent 
              bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm 
              hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 
              focus:ring-offset-2"
          >
            Generate Resume
          </button>
        </Form>
      </div>
    </div>
  );
}
