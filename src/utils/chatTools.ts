import type { TMessage, TNote, TTask } from "../types";
import { toolify, TTool } from "./ai";
import type { TInputContentPart, TResponsesFetchInputItem } from "./backgroundResponses";
import { ChromeStorageManager } from "../managers/Storage";
import {
  clickElementBySelector,
  extractClickableElements,
  extractEditableElements,
  extractPageData,
  fillElementBySelector,
  generateRandomId,
} from "./lib";
import { migrateNote, migrateTask } from "./tags";
import { createStoredImage, editStoredImage } from "./storedImages";

export const buildChatSystemPrompt = (
  systemPrompt: string,
  pageUrl: string
): string => {
  return `${systemPrompt}\n${pageUrl ? `Current URL: ${pageUrl}` : ""}\nIf the user explicitly asks to create/save a note, call createCreate. If the user explicitly asks to create/save a task, call create_task. You can generate pictures and edit pictures already in this chat. If the user asks for a new image or picture, call generate_image. If the user asks to change or edit a picture already in the chat, call edit_image with its attachment id from attachment:ID. If they do not name one, leave attachmentId empty and the latest picture is used.\nWhen referring to notes and tasks, include clickable markdown links using these formats:\n- [label](note:note-id)\n- [label](task:task-id)\nAfter createCreate/create_task, include the markdownLink returned by the tool in your answer. After generate_image or edit_image, include the markdownLink returned by the tool in your answer unchanged.`;
};

const messageContent = (message: TMessage): string | TInputContentPart[] => {
  const attachments = message.attachments ?? [];
  if (attachments.length === 0) return message.content;

  const parts: TInputContentPart[] = [];
  if (message.content.trim()) {
    parts.push({ type: "input_text", text: message.content });
  }
  for (const attachment of attachments) {
    if (attachment.mimeType.startsWith("image/")) {
      parts.push({
        type: "input_image",
        detail: "auto",
        image_url: attachment.dataUrl,
      });
      continue;
    }
    parts.push({
      type: "input_file",
      filename: attachment.name,
      file_data: attachment.dataUrl,
    });
  }
  return parts;
};

export const messagesToChatResponsesInput = (
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
      content: messageContent(message),
    }));
};

export const createChatTools = (deps: {
  tabId?: number;
  conversationId?: string;
  imageContext?: string;
}): TTool[] => {
  const { tabId, conversationId, imageContext } = deps;
  const attachmentIds = Array.from(
    (imageContext || "").matchAll(/attachments?:([A-Za-z0-9_-]+)/gi)
  ).map((match) => match[1]);
  const latestImageId = attachmentIds[attachmentIds.length - 1] || "";

  const getWebsiteContent = toolify(
    async (args: { start: number; end: number }) => {
      if (tabId == null) {
        return "There was an error trying to get the website content. the error was: No active tab found";
      }
      try {
        const { url, content } = await extractPageData(
          Number(args.start),
          Number(args.end),
          tabId
        );
        return JSON.stringify({ url, content });
      } catch (error) {
        console.log("error trying to get website content", error);
        return (
          "There was an error trying to get the website content. the error was: " +
          error
        );
      }
    },
    "getWebsiteContent",
    "Get the content of the current website, you can decide how much content to access using the start and end parameters. The start and end parameters are the percentage of the content to access from 0 to 1. For example, if you want to access the first 50% of the content, you can use the start parameter as 0 and the end parameter as 0.5. If you want to access the last 50% of the content, you can use the start parameter as 0.5 and the end parameter as 1. You will never be able of extracting more than 30 percent at once for safety reasons. So the maximun different between start and end is 0.3",
    {
      start: {
        type: "number",
        description: "The percentage of the content to access from 0 to 1",
      },
      end: {
        type: "number",
        description: "The percentage of the content to access from 0 to 1",
      },
    }
  );

  const clickElementBySelectorTool = toolify(
    async (args: { selector: string }) => {
      if (tabId == null) {
        return "There was an error trying to click the element. the error was: No active tab found";
      }
      try {
        await clickElementBySelector(args.selector, tabId);
        console.log("AI tried to click element", args.selector);
        return "Element clicked successfully";
      } catch (error) {
        return (
          "There was an error trying to click the element. the error was: " +
          error
        );
      }
    },
    "clickElementBySelector",
    "Click on the element with the given selector",
    {
      selector: { type: "string", description: "The selector of the element" },
    }
  );

  const getClickableElements = toolify(
    async () => {
      if (tabId == null) {
        return "There was an error trying to get the clickable elements. the error was: No active tab found";
      }
      try {
        const elements = await extractClickableElements(tabId);
        return JSON.stringify(elements);
      } catch (error) {
        return (
          "There was an error trying to get the clickable elements. the error was: " +
          error
        );
      }
    },
    "getClickableElements",
    "Get the clickable elements of the current website",
    {}
  );

  const getEditableElements = toolify(
    async () => {
      if (tabId == null) {
        return "There was an error trying to get the editable elements. the error was: No active tab found";
      }
      try {
        console.log("AI tried to get editable elements");
        const elements = await extractEditableElements(tabId);
        return JSON.stringify(elements);
      } catch (error) {
        return (
          "There was an error trying to get the editable elements. the error was: " +
          error
        );
      }
    },
    "getEditableElements",
    "Get the editable elements of the current website",
    {}
  );

  const fillElementBySelectorTool = toolify(
    async (args: { selector: string; text: string }) => {
      if (tabId == null) {
        return "There was an error trying to fill the element. the error was: No active tab found";
      }
      try {
        await fillElementBySelector(args.selector, args.text, tabId);
        console.log("AI tried to fill element", args.selector, args.text);
        return "Element filled successfully";
      } catch (error) {
        return (
          "There was an error trying to fill the element. the error was: " +
          error
        );
      }
    },
    "fillElementBySelector",
    "Fill the element with the given selector with the given text",
    {
      selector: { type: "string", description: "The selector of the element" },
      text: {
        type: "string",
        description: "The text to fill the element with",
      },
    }
  );

  const createCreateTool = toolify(
    async (args: { title: string; content: string }) => {
      try {
        const storedNotes = (await ChromeStorageManager.get("notes")) || [];
        const notes: TNote[] = Array.isArray(storedNotes)
          ? storedNotes.map(migrateNote)
          : [];
        const note: TNote = {
          id: generateRandomId("note"),
          title: (args.title || "").trim() || "Untitled note",
          nodes: args.content
            ? [
                {
                  id: generateRandomId("node"),
                  type: "markdown",
                  content: args.content,
                },
              ]
            : [],
          color: "var(--bg-color)",
          backgroundType: "solid",
          color2: "var(--bg-color-secondary)",
          tags: [],
          archived: false,
          createdAt: new Date().toISOString(),
          imageURL: "",
        };
        await ChromeStorageManager.add("notes", [...notes, note]);
        return JSON.stringify({
          success: true,
          message: "Note created successfully",
          noteId: note.id,
          title: note.title,
          link: `note:${note.id}`,
          markdownLink: `[${note.title || "Open note"}](note:${note.id})`,
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          message: "Failed to create note",
          error: String(error),
        });
      }
    },
    "createCreate",
    "Create a new note. Use this only when the user asks to create/save a note from the current conversation.",
    {
      title: {
        type: "string",
        description: "Title of the note",
      },
      content: {
        type: "string",
        description: "Main content/body of the note",
      },
    }
  );

  const createTaskTool = toolify(
    async (args: { title: string; description: string }) => {
      try {
        const tasksRaw = (await ChromeStorageManager.get("tasks")) || [];
        const tasks: TTask[] = Array.isArray(tasksRaw)
          ? tasksRaw.map(migrateTask)
          : [];
        const task: TTask = {
          id: generateRandomId("task"),
          title: (args.title || "").trim() || "New task",
          description: args.description || "",
          priority: "medium",
          status: "TODO",
          createdAt: new Date().toISOString(),
          motivationText: "",
          estimatedTimeUnit: "minutes",
          tags: [],
        };
        await ChromeStorageManager.add("tasks", [...tasks, task]);
        return JSON.stringify({
          success: true,
          message: "Task created successfully",
          taskId: task.id,
          title: task.title,
          link: `task:${task.id}`,
          markdownLink: `[${task.title || "Open task"}](task:${task.id})`,
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          message: "Failed to create task",
          error: String(error),
        });
      }
    },
    "create_task",
    "Create a new task. Use this only when the user asks to create/save a task from the current conversation.",
    {
      title: {
        type: "string",
        description: "Title of the task",
      },
      description: {
        type: "string",
        description: "Task details/description",
      },
    }
  );

  const generateImageTool = toolify(
    async (args: { instruction: string; altText: string; size: string }) => {
      const instruction = args.instruction?.trim();
      if (!instruction) {
        return JSON.stringify({
          success: false,
          message: "No instruction provided",
        });
      }
      try {
        const stored = await createStoredImage({
          prompt: instruction,
          context: imageContext,
          altText: args.altText?.trim() || "generated image",
          size: args.size,
          sourceConversationId: conversationId,
        });
        return JSON.stringify({
          success: true,
          attachmentId: stored.attachmentId,
          markdownLink: stored.markdownLink,
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          message: "Failed to generate image",
          error: String(error),
        });
      }
    },
    "generate_image",
    "Generate an image when the user asks for a picture. Wait for this tool, then paste markdownLink into the reply unchanged.",
    {
      instruction: {
        type: "string",
        description:
          "Detailed image instruction. Expand the user's intent with subject, style, and composition.",
      },
      altText: {
        type: "string",
        description: "Short label for the image.",
      },
      size: {
        type: "string",
        description:
          "Image size. Must be one of: 1024x1024 (square), 1024x1536 (portrait), 1536x1024 (landscape), auto.",
      },
    }
  );

  const editImageTool = toolify(
    async (args: {
      attachmentId: string;
      instruction: string;
      altText: string;
      size: string;
    }) => {
      const instruction = args.instruction?.trim();
      const attachmentId = args.attachmentId?.trim() || latestImageId;
      if (!instruction) {
        return JSON.stringify({
          success: false,
          message: "No instruction provided",
        });
      }
      if (!attachmentId) {
        return JSON.stringify({
          success: false,
          message: "No image to edit",
        });
      }
      try {
        const stored = await editStoredImage({
          sourceAttachmentId: attachmentId,
          prompt: instruction,
          altText: args.altText?.trim() || "edited image",
          size: args.size,
          sourceConversationId: conversationId,
        });
        return JSON.stringify({
          success: true,
          attachmentId: stored.attachmentId,
          markdownLink: stored.markdownLink,
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          message: "Failed to edit image",
          error: String(error),
        });
      }
    },
    "edit_image",
    "Edit a picture already in the chat. Use this when the user wants to change an existing image. Pass the attachment id from attachment:ID, or leave it empty to edit the latest picture. Describe only the change. Paste markdownLink into the reply unchanged.",
    {
      attachmentId: {
        type: "string",
        description:
          "Id from attachment:ID in the chat. Leave empty to edit the latest picture.",
      },
      instruction: {
        type: "string",
        description: "What to change in the existing picture.",
      },
      altText: {
        type: "string",
        description: "Short label for the edited image.",
      },
      size: {
        type: "string",
        description:
          "Image size. Use auto to keep the current shape, or one of: 1024x1024, 1024x1536, 1536x1024.",
      },
    }
  );

  return [
    getWebsiteContent,
    getClickableElements,
    clickElementBySelectorTool,
    fillElementBySelectorTool,
    getEditableElements,
    generateImageTool,
    editImageTool,
    createCreateTool,
    createTaskTool,
  ];
};
