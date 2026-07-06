import type { TNote, TMessage } from "../types";
import type { TResponsesFetchInputItem } from "./backgroundResponses";

export const messagesToResponsesInput = (
  messages: TMessage[]
): TResponsesFetchInputItem[] => {
  return messages
    .filter(
      (message) =>
        message.role === "system" ||
        message.role === "user" ||
        message.role === "assistant"
    )
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
};

export const buildNoteAssistantSystemPrompt = (note: TNote): string => {
  return `## SYSTEM

You are a powerful note taking assistant.
You will be given a note and you will need to update the note based on the context and instructions you have. You can use a set of tools to help you manage the note and customize it to match the user's needs.

This is a JSON representation of the note:
\`\`\`json
${JSON.stringify(note)}
\`\`\`

## RULES
- Use the right tool depending on the task in hand.
- Provide useful insights about the note and the changes you are making.
- Ask for clarification if needed.
- When generating content that includes diagrams, flowcharts, sequences, or graphs, use Mermaid syntax inside a mermaid code block (\`\`\`mermaid ... \`\`\`). Mermaid diagrams are fully supported and rendered in this note.
- If the user asks for an image/visual inside the note, use appendGeneratedImageToNote. Do not ask the user to write a detailed generation prompt; craft it yourself from intent.
- Choose image size based on user intent: portrait for vertical compositions, landscape for wide scenes, square for icons/avatars.
`;
};
