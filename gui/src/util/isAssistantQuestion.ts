export function isAssistantQuestion(content: string): boolean {
  const withoutFences = content.replace(/```[\s\S]*?```/g, " ");
  const prose = withoutFences.replace(/`[^`\n]*`/g, " ").trim();
  return prose.endsWith("?");
}
