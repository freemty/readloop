export function bookSlug(title: string, author: string): string {
  return slugify(`${title}-${author}`)
}

export function nodeSlug(title: string): string {
  return slugify(title)
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[&/\\:;!?@#$%^*()+=\[\]{}<>|"'`~,]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}
