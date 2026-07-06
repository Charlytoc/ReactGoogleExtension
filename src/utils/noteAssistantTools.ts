import type { FunctionTool } from "openai/resources/responses/responses";
import type { TNote } from "../types";
import { toolify, TTool } from "./ai";
import { generateRandomId } from "./lib";
import { saveImageJob, type TGenerateNoteImageMessage } from "./imageJobs";

type TImageSizeOption = "1024x1024" | "1024x1536" | "1536x1024" | "auto";

const normalizeImageSize = (size: string): TImageSizeOption => {
  const allowed: TImageSizeOption[] = [
    "1024x1024",
    "1024x1536",
    "1536x1024",
    "auto",
  ];
  return allowed.includes(size as TImageSizeOption)
    ? (size as TImageSizeOption)
    : "1024x1024";
};

const getNotesFromStorage = async (): Promise<TNote[]> => {
  const result = await chrome.storage.local.get("notes");
  const notes = result.notes;
  return Array.isArray(notes) ? (notes as TNote[]) : [];
};

const saveNotesToStorage = async (notes: TNote[]): Promise<void> => {
  await chrome.storage.local.set({ notes });
};

const getNoteById = async (noteId: string): Promise<TNote | undefined> => {
  const notes = await getNotesFromStorage();
  return notes.find((note) => note.id === noteId);
};

const updateStoredNote = async (
  noteId: string,
  patch: Partial<TNote>
): Promise<TNote | undefined> => {
  const notes = await getNotesFromStorage();
  let updated: TNote | undefined;
  const next = notes.map((note) => {
    if (note.id !== noteId) return note;
    updated = { ...note, ...patch };
    return updated;
  });
  if (!updated) return undefined;
  await saveNotesToStorage(next);
  return updated;
};

const buildNoteImageContext = (note: TNote, blockContext?: string): string => {
  const noteContext = `Note title: ${note.title || "Untitled"}

Note content (excerpt):
${(note.content || "").slice(0, 1500)}`;

  const block = blockContext?.trim();
  if (!block) {
    return noteContext;
  }

  return `Selected block — the image will illustrate this part of the note:
${block}

Full note for additional context:
${noteContext}`;
};

export type TNoteAssistantToolDeps = {
  noteId: string;
  enqueueImageJob: (request: TGenerateNoteImageMessage) => Promise<void>;
};

export const createNoteAssistantTools = (
  deps: TNoteAssistantToolDeps
): TTool[] => {
  const { noteId, enqueueImageJob } = deps;

  const updateNoteContent = toolify(
    async (args: { newContent: string }) => {
      const updated = await updateStoredNote(noteId, {
        content: args.newContent,
      });
      if (!updated) return "Note not found";
      return "Note updated successfully";
    },
    "updateNoteContent",
    "Update the content of the note. Use this tool when you need to make changes to the note. The function expects a string representing the entire content of the note.",
    {
      newContent: {
        type: "string",
        description:
          "The new content to update the note. The content should be a string representing the entire content of the note.",
      },
    }
  );

  const updateColorTool = toolify(
    async (args: { color: string }) => {
      const updated = await updateStoredNote(noteId, { color: args.color });
      if (!updated) return "Note not found";
      return "Color updated successfully";
    },
    "updateColorTool",
    "Update the background color of the note. The color should be a valid CSS color. Include the alpha value if you want a transparent color.",
    {
      color: {
        type: "string",
        description: "The new color to update the note",
      },
    }
  );

  const updateTitleTool = toolify(
    async (args: { title: string }) => {
      const updated = await updateStoredNote(noteId, { title: args.title });
      if (!updated) return "Note not found";
      return "Title updated successfully";
    },
    "updateTitleTool",
    "Update the title of the note. The title should be a string. The title should be a short description of the note.",
    {
      title: {
        type: "string",
        description: "The new title to update the note",
      },
    }
  );

  const appendGeneratedImageToNote = toolify(
    async (args: { instruction: string; altText: string; size: string }) => {
      const note = await getNoteById(noteId);
      if (!note) return "Note not found";

      const instruction = args.instruction?.trim();
      if (!instruction) return "No instruction provided";

      const attachmentId = generateRandomId("attachment");
      const label = args.altText?.trim() || "generated image";
      const markdown = `![${label}](attachment:${attachmentId})`;
      const content = `${note.content || ""}\n\n${markdown}\n`;

      await updateStoredNote(noteId, { content });

      await saveImageJob({
        attachmentId,
        noteId,
        prompt: instruction,
        context: buildNoteImageContext(note),
        altText: label,
        size: normalizeImageSize(args.size),
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      await enqueueImageJob({
        action: "generateNoteImage",
        attachmentId,
        noteId,
        prompt: instruction,
        context: buildNoteImageContext(note),
        altText: label,
        size: normalizeImageSize(args.size),
      });

      return JSON.stringify({
        success: true,
        status: "generating",
        detail:
          "Image generation started in the background. The markdown placeholder was already appended to the note and will display the image once ready.",
        attachmentId,
        markdown,
      });
    },
    "appendGeneratedImageToNote",
    "Generate an image attachment and append it inside the note content as markdown. Use this when the user asks for a visual/image in the note. You should provide a detailed generation instruction based on user intent.",
    {
      instruction: {
        type: "string",
        description:
          "Detailed image generation instruction. Expand the user's intent into a richer prompt with style/composition details.",
      },
      altText: {
        type: "string",
        description: "Short alt text for the markdown image label.",
      },
      size: {
        type: "string",
        description:
          "Image size/aspect ratio. Must be one of: 1024x1024 (square), 1024x1536 (portrait), 1536x1024 (landscape), auto.",
      },
    }
  );

  return [
    updateNoteContent,
    updateColorTool,
    updateTitleTool,
    appendGeneratedImageToNote,
  ];
};

export const getNoteAssistantToolSchemas = (
  deps: TNoteAssistantToolDeps
): FunctionTool[] => {
  return createNoteAssistantTools(deps).map((tool) => tool.schema);
};
