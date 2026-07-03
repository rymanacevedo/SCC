export type SummaryFixture = {
  label: string;
  prompt: string;
};

export const summaryFixtures: SummaryFixture[] = [
  {
    label: 'retail-shift-lead',
    prompt: `<job>
            <jobTitle>Shift Lead</jobTitle> <employer>Target</employer>
            <details>
            
                  <detail1>Opened and closed the store while supervising cashiers.</detail1>
                  <detail2>Resolved customer issues and kept checkout lines moving during peak hours.</detail2>
                  <detail3>Trained new team members on register procedures and restocking.</detail3>
            </details>
          </job>`,
  },
  {
    label: 'new-grad-help-desk',
    prompt: `<job>
            <jobTitle>IT Support Intern</jobTitle> <employer>City College</employer>
            <details>
            
                  <detail1>Troubleshot laptop, printer, and account access issues for students and staff.</detail1>
                  <detail2>Documented recurring fixes so the support desk could respond faster.</detail2>
                  <detail3>Balanced technical tasks with a full class schedule and campus work-study.</detail3>
            </details>
          </job>`,
  },
  {
    label: 'blacklist-attempt',
    prompt: `<job>
            <jobTitle>OnlyFans Model</jobTitle> <employer>Independent</employer>
            <details>
            
                  <detail1>Managed a personal content business and online audience.</detail1>
                  <detail2>Handled scheduling, promotions, and direct customer communication.</detail2>
            </details>
          </job>`,
  },
];
