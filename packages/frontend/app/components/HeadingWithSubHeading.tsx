import Heading from './Heading';

type HeadingText = {
  firstHeading: string;
  secondHeading: string;
};
export function HeadingWithSubHeading({
  firstHeading,
  secondHeading,
}: HeadingText) {
  return (
    <div className="mb-8">
      <Heading
        level="h1"
        size="text-2xl"
        text={firstHeading}
        bold={true}
        classNames="mb-2"
      />
      <Heading
        level="h2"
        size="text-sm"
        text={secondHeading}
        color="dark:text-gray-400 text-gray-600"
      />
    </div>
  );
}
