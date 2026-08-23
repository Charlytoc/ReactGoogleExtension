import type { FunctionTool } from "openai/resources/responses/responses";
import type { TNode, TNodeType, TNote } from "../types";
import { toolify, TTool } from "./ai";
import { generateRandomId } from "./lib";
import { saveImageJob, type TGenerateNoteImageMessage } from "./imageJobs";

const normalizeNodeType = (value: string | undefined): TNodeType =>
  value === "table" || value === "image" ? value : "markdown";

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
${note.nodes.map((n) => n.content).join("\n\n").slice(0, 1500)}`;

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

  const updateNode = toolify(
    async (args: { nodeId: string; content: string; nodeType?: string }) => {
      const note = await getNoteById(noteId);
      if (!note) return "Note not found";
      if (!note.nodes.some((n) => n.id === args.nodeId)) {
        return `Node not found: ${args.nodeId}`;
      }
      await updateStoredNote(noteId, {
        nodes: note.nodes.map((n): TNode =>
          n.id === args.nodeId
            ? {
                ...n,
                content: args.content,
                type: args.nodeType ? normalizeNodeType(args.nodeType) : n.type,
              }
            : n
        ),
      });
      return "Node updated successfully";
    },
    "updateNode",
    "Replace the content of a single existing node in the note. Use this to edit one paragraph/heading/list/etc without touching the rest of the note.",
    {
      nodeId: {
        type: "string",
        description: "The id of the node to update.",
      },
      content: {
        type: "string",
        description:
          "The new markdown content for this node (one block). For a table node, this must be a GFM markdown table (header row, separator row, data rows).",
      },
      nodeType: {
        type: "string",
        description:
          "Optional. One of \"markdown\", \"table\", or \"image\". Omit to keep the node's current type; pass \"table\" to convert this node into a table (content must then be a GFM markdown table); pass \"image\" with content `![alt](attachment:id)` referencing an existing attachment, or \"\" to leave it as an empty image placeholder for the user to fill in.",
      },
    }
  );

  const insertNode = toolify(
    async (args: { afterNodeId: string; content: string; nodeType?: string }) => {
      const note = await getNoteById(noteId);
      if (!note) return "Note not found";
      const newNode: TNode = {
        id: generateRandomId("node"),
        type: normalizeNodeType(args.nodeType),
        content: args.content,
      };
      const afterNodeId = args.afterNodeId?.trim();
      const index = afterNodeId
        ? note.nodes.findIndex((n) => n.id === afterNodeId)
        : -1;
      if (afterNodeId && index === -1) {
        return `Node not found: ${afterNodeId}`;
      }
      const nodes = [...note.nodes];
      nodes.splice(index + 1, 0, newNode);
      await updateStoredNote(noteId, { nodes });
      return JSON.stringify({ success: true, nodeId: newNode.id });
    },
    "insertNode",
    "Insert a new node (one block) into the note at a given position.",
    {
      afterNodeId: {
        type: "string",
        description:
          "Insert the new node right after this node id. Pass an empty string to insert at the very start of the note.",
      },
      content: {
        type: "string",
        description:
          "Markdown content for the new node (one block). For a table node, this must be a GFM markdown table (header row, separator row, data rows), e.g. \"| A | B |\\n| --- | --- |\\n| 1 | 2 |\".",
      },
      nodeType: {
        type: "string",
        description:
          "One of \"markdown\" (default), \"table\", or \"image\". Use \"table\" when the user asks for a table. For a new image, prefer appendGeneratedImageToNote instead — it generates the image for you; only use insertNode with nodeType \"image\" if you already have an attachment id to reference.",
      },
    }
  );

  const deleteNode = toolify(
    async (args: { nodeId: string }) => {
      const note = await getNoteById(noteId);
      if (!note) return "Note not found";
      if (!note.nodes.some((n) => n.id === args.nodeId)) {
        return `Node not found: ${args.nodeId}`;
      }
      await updateStoredNote(noteId, {
        nodes: note.nodes.filter((n) => n.id !== args.nodeId),
      });
      return "Node deleted successfully";
    },
    "deleteNode",
    "Delete a single node from the note.",
    {
      nodeId: {
        type: "string",
        description: "The id of the node to delete.",
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
      const newNode = {
        id: generateRandomId("node"),
        type: "image" as const,
        content: markdown,
      };

      await updateStoredNote(noteId, { nodes: [...note.nodes, newNode] });

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
    "Generate an image and append it to the note as a new image node. Use this when the user asks for a visual/image in the note. You should provide a detailed generation instruction based on user intent.",
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
    updateNode,
    insertNode,
    deleteNode,
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
