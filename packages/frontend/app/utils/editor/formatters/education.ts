import type { User } from './../../user';
type Education = User['education'];
type EducationFormat = {
  degreeSection: string;
  location: string;
  graduationInfo: string;
};

export function formatEducationString(education: Education): EducationFormat {
  const degreeSection = [education.degree, education.educationLevel]
    .filter(Boolean)
    .join(' - ');
  const location = [education.schoolName, education.location]
    .filter(Boolean)
    .join(', ');

  const gradDate = education.currentlyEnrolled
    ? 'Currently Enrolled'
    : education.graduationDate?.toString();

  const graduationInfo = gradDate ? `Graduation: ${gradDate}` : '';

  return {
    degreeSection,
    location,
    graduationInfo,
  };
}
