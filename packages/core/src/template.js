// The starting point for a new script: every title page field that prints, filled
// with placeholders so writers can see what's available and delete what they don't need.

export function newScript(today = new Date()) {
  const date = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return [
    'Title: Untitled',
    'Credit: Written by',
    'Author: Your Name',
    'Source: Based On Blank',
    `Draft date: ${date}`,
    'Contact:',
    '    Your Name',
    '    you@example.com',
    '    555-555-5555',
    `Copyright: (c) ${today.getFullYear()} Your Name`,
    'Notes: First draft',
    '',
    '',
  ].join('\n');
}
