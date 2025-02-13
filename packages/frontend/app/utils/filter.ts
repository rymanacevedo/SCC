import { Filter } from 'bad-words';

export const filter = new Filter();
const blacklist = [
  'Sex Worker',
  'Porn Star',
  'Adult Film',
  'Escort',
  'Cam Model',
  'Stripper',
  'Exotic Dancer',
  'Erotic Dancer',
  'Pornographic Content Creator',
  'Explicit Performer',
  'Performer of Explicit Content',
  'Shit Talker',
  'OnlyFans',
  'Fansly',
  'Porn Addict',
  'Terrorist',
  'Extremist',
  'Jihadist',
  'Bomber',
  'Assassin',
  'Violent Extremist',
  'Hate Crime Inciter',
  'Radicalizer',
  'Domestic Terrorist',
];
filter.addWords(...blacklist);

export const containsInappropriateWords = (input: string): string | null => {
  if (filter.isProfane(input)) {
    return input.split(' ').find((word) => filter.isProfane(word)) || null;
  }
  return null;
};
