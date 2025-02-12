import { memo } from 'react';
import Heading from '../../components/Heading';
import Button from '../../components/Button';

function EducationLevel() {
  return (
    <main className="max-w-2xl mx-auto">
      <div className="mb-8">
        <Heading
          level="h1"
          size="text-2xl"
          text="What best describes your level of education?"
          bold={true}
          classNames="mb-2"
        />
        <Heading
          level="h2"
          size="text-sm"
          text="Select the best option and we'll help you structure your education section."
          color="dark:text-gray-400 text-gray-600"
        />
      </div>
      <div className="flex flex-col md:flex-row md:flex-wrap justify-center gap-4 max-w-xs md:max-w-4xl mx-auto">
        {[
          'High School or GED',
          'Associates',
          'Bachelors',
          'Masters',
          'PhD',
          'Some College',
          'Vocational',
        ].map((e) => (
          <Button
            key={e}
            text={e}
            type="secondary"
            action="button"
            callback={() => {}}
          />
        ))}
      </div>
    </main>
  );
}

export default memo(EducationLevel);
