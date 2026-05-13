import { useCallback, useEffect, useMemo, useState } from "react";
import {
  convertToMessage,
  createCompletion,
  // createStreamingResponse,
  createStreamingResponseWithFunctions,
  createToolsMap,
  listModels,
  toolify,
} from "../../utils/ai";
import { MODEL_CHAT_SMALL } from "../../utils/models";
import { ChromeStorageManager } from "../../managers/Storage";
import { Button } from "../Button/Button";
import { TMessage } from "../../types";
import { SVGS } from "../../assets/svgs";
import "./Chat.css";
import { StyledMarkdown } from "../RenderMarkdown/StyledMarkdown";
import {
  clickElementBySelector,
  extractClickableElements,
  extractEditableElements,
  extractPageData,
  fillElementBySelector,
  generateRandomId,
} from "../../utils/lib";
import { migrateTask } from "../../utils/tags";
import { notify } from "../../utils/chromeFunctions";
import { TConversation, TModel } from "../../types";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Section } from "../Section/Section";
import { TNote, TTask } from "../../types";
import { AIInput } from "../AIInput/AIInput";
import { ActionIcon, Button as MantineButton, Divider, Group, Modal, Select as MantineSelect, Slider, Stack, Switch, Text, Textarea as MantineTextarea, TextInput, Title, Tooltip } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";

const generateConversationTitle = async (context: string, apiKey: string) => {
  const messages: TMessage[] = [
    {
      role: "system",
      content:
        "You are a helpful assistant. Your job is to generate a title for a conversation based on the context provided. Return only the title, no other text. The title must start with an emoji and should be in the same language as the messages in the context.",
    },
    { role: "user", content: context },
  ];
  const title = await createCompletion(
    {
      model: MODEL_CHAT_SMALL,
      messages: messages.map(convertToMessage),
      temperature: 0.5,
      max_completion_tokens: 4000,
      response_format: { type: "text" },
      apiKey,
    },
    (completion) => {
      return completion.choices[0].message.content;
    }
  );
  return title;
};

const defaultMessages: TMessage[] = [
  { role: "system", content: "You are a helpful assistant." },
];

type TAttachment = {
  url: string;
  content: string;
  type: "text" | "image" | "video" | "audio" | "file";
  name: string;
};

type TChatTab = "history" | "config" | "chat" | "prompts";

type TPrompt = {
  id: string;
  name: string;
  content: string;
  pinned?: boolean;
};

const extractVariables = (content: string): string[] => {
  const matches = content.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(2, -2).trim()))];
};

const fillVariables = (
  content: string,
  values: Record<string, string>
): string =>
  content.replace(
    /\{\{([^}]+)\}\}/g,
    (_, key) => values[key.trim()] ?? `{{${key}}}`
  );

const appendSystemPrompt = (
  systemPrompt: string,
  messages: TMessage[]
): TMessage[] => {
  console.log("appendSystemPrompt", systemPrompt, messages);
  
  const systemMessageIndex = messages.findIndex(
    (message) => message.role === "system"
  );
  if (systemMessageIndex === -1) {
    return [{ role: "system", content: systemPrompt }, ...messages];
  }
  return messages.map((message) => {
    if (message.role === "system") {
      return { ...message, content: systemPrompt };
    }
    return message;
  });
};
export const Chat = () => {
  const [messages, setMessages] = useState<TMessage[]>(defaultMessages);
  const [conversation, setConversation] = useState<TConversation | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [aiConfig, setAiConfig] = useState<TAIConfig>({
    systemPrompt: "You are a helpful assistant.",
    model: {
      name: "GPT-5.4 mini",
      slug: MODEL_CHAT_SMALL,
      hasReasoning: false,
    },
    autoSaveConversations: true,
    setTitleAtMessage: 0,
  });
  const [activeTab, setActiveTab] = useState<TChatTab>("chat");
  const [conversations, setConversations] = useState<TConversation[]>([]);
  const [error, setError] = useState<string>("");
  const [attachments, setAttachments] = useState<TAttachment[]>([]);
  const [prompts, setPrompts] = useState<TPrompt[]>([]);
  const [promptPicker, setPromptPicker] = useState<{
    selected: TPrompt | null;
    variableValues: Record<string, string>;
  }>({ selected: null, variableValues: {} });
  const [pinnedFiller, setPinnedFiller] = useState<{
    prompt: TPrompt;
    values: Record<string, string>;
  } | null>(null);
  const autoScroll = true;
  const { t } = useTranslation();

  useEffect(() => {
    getApiKey();
    getConversations();
    getAiConfig();
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    const stored = await ChromeStorageManager.get("savedPrompts");
    if (Array.isArray(stored)) setPrompts(stored);
  };

  const savePrompts = async (next: TPrompt[]) => {
    setPrompts(next);
    await ChromeStorageManager.add("savedPrompts", next);
  };

  const applySavedPrompt = useCallback((p: TPrompt) => {
    const vars = extractVariables(p.content);
    setActiveTab("chat");
    if (vars.length === 0) {
      setInput(p.content);
      setPromptPicker({ selected: null, variableValues: {} });
    } else {
      const initial: Record<string, string> = {};
      vars.forEach((v) => {
        initial[v] = "";
      });
      setPromptPicker({ selected: p, variableValues: initial });
    }
  }, []);

  useEffect(() => {
    if (input.includes("/send")) {
      handleSendMessage();
    }
  }, [input]);

  useEffect(() => {
    const systemMessageIndex = messages.findIndex(
      (message) => message.role === "system"
    );
    if (systemMessageIndex === -1) {
      setMessages([
        ...messages,
        { role: "system", content: aiConfig.systemPrompt },
      ]);
    } else {
      const newMessages = messages.map((message) => {
        if (message.role === "system") {
          return { ...message, content: aiConfig.systemPrompt };
        }
        return message;
      });
      setMessages(newMessages);
    }
  }, [aiConfig.systemPrompt]);

  useEffect(() => {
    if (aiConfig.autoSaveConversations) {
      saveConversation();
    }
    if (autoScroll) {
      const chatMessages = document.querySelector(".chat-messages");
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  }, [messages]);

  const getApiKey = async () => {
    const apiKey = await ChromeStorageManager.get("openaiApiKey");
    if (!apiKey) {
      setError("No API key found");
    }

    setApiKey(apiKey);
  };

  const getAiConfig = async () => {
    let aiConfig: TAIConfig = await ChromeStorageManager.get("aiConfig");
    if (!aiConfig) {
      aiConfig = {
        systemPrompt: `You are a helpful assistant. `,
        model: {
          name: "GPT-5.4 mini",
          slug: MODEL_CHAT_SMALL,
          hasReasoning: false,
        },
        autoSaveConversations: true,
        setTitleAtMessage: 0,
      };
    }

    setAiConfig(aiConfig);
  };

  const updateAiConfig = async (newConfig: TAIConfig) => {
    console.log(newConfig, "newConfig");

    setAiConfig(newConfig);
    await ChromeStorageManager.add("aiConfig", newConfig);
    notify(t("aiConfigUpdated"), "✅");
    setActiveTab("chat");
  };

  const createNewConversation = async () => {
    const newConversation: TConversation = {
      id: generateRandomId("conversation"),
      messages: [],
      title: "",
      date: new Date().toISOString(),
    };
    setConversation(newConversation);
    setMessages(defaultMessages);
  };

  const getConversations = async () => {
    const conversations: TConversation[] = await ChromeStorageManager.get(
      "conversations"
    );
    if (!Array.isArray(conversations)) {
      setConversations([]);
      createNewConversation();
      return;
    }
    setConversations(conversations);

    const conversation = conversations.find((c) => c.messages.length <= 1);
    if (conversation) {
      setConversation(conversation);
    } else {
      createNewConversation();
    }
  };

  // const addAttachment = (attachment: TAttachment) => {
  //   setAttachments([...attachments, attachment]);
  // };

  // const uploadFile = async (file: File) => {
  //   const reader = new FileReader();
  //   reader.onload = (e) => {
  //     const attachment: TAttachment = {
  //       url: e.target?.result as string,
  //       content: "",
  //       type: "file",
  //       name: file.name,
  //     };
  //     addAttachment(attachment);
  //   };
  //   reader.readAsDataURL(file);
  // };

  const getWebsiteContent = toolify(
    async (args: { start: number; end: number }) => {
      console.log(args, "IA is trying to get website content");
      
      try {
        const { url, content } = await extractPageData(Number(args.start), Number(args.end));
        return JSON.stringify({ url, content });
      } catch (error) {
        console.log("error trying to get website content", error);
        return "There was an error trying to get the website content. the error was: " + error;
      }
    },
    "getWebsiteContent",
    "Get the content of the current website, you can decide how much content to access using the start and end parameters. The start and end parameters are the percentage of the content to access from 0 to 1. For example, if you want to access the first 50% of the content, you can use the start parameter as 0 and the end parameter as 0.5. If you want to access the last 50% of the content, you can use the start parameter as 0.5 and the end parameter as 1. You will never be able of extracting more than 30 percent at once for safety reasons. So the maximun different between start and end is 0.3",
    {
      start: { type: "number", description: "The percentage of the content to access from 0 to 1" },
      end: { type: "number", description: "The percentage of the content to access from 0 to 1" },
    }
  );

  const clickElementBySelectorTool = toolify(
    (args: { selector: string }) => {
      clickElementBySelector(args.selector);
      console.log("AI tried to click element", args.selector);

      return "Element clicked successfully";
    },
    "clickElementBySelector",
    "Click on the element with the given selector",
    {
      selector: { type: "string", description: "The selector of the element" },
    }
  );

  const getClickableElements = toolify(
    async () => {
      const elements = await extractClickableElements();
      return JSON.stringify(elements);
    },
    "getClickableElements",
    "Get the clickable elements of the current website",
    {}
  );

  const getEditableElements = toolify(
    async () => {
      console.log("AI tried to get editable elements");
      const elements = await extractEditableElements();
      return JSON.stringify(elements);
    },
    "getEditableElements",
    "Get the editable elements of the current website",
    {}
  );

  const fillElementBySelectorTool = toolify(
    (args: { selector: string; text: string }) => {
      fillElementBySelector(args.selector, args.text);
      console.log("AI tried to fill element", args.selector, args.text);
      return "Element filled successfully";
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
        const notes: TNote[] = (await ChromeStorageManager.get("notes")) || [];
        const note: TNote = {
          id: generateRandomId("note"),
          title: (args.title || "").trim() || "Untitled note",
          content: args.content || "",
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

  const handleSendMessage = async () => {
    if (!input) return;

    let url = "";

    try {
      const { url: _url } = await extractPageData(0, 0.01);
      url = _url;
    } catch (error) {
      console.log("error trying to get url", error);
    }
    const systemPrompt = `${aiConfig.systemPrompt}\n${url ? `Current URL: ${url}` : ""}\nIf the user explicitly asks to create/save a note, call createCreate. If the user explicitly asks to create/save a task, call create_task.\nWhen referring to notes and tasks, include clickable markdown links using these formats:\n- [label](note:note-id)\n- [label](task:task-id)\nAfter createCreate/create_task, include the markdownLink returned by the tool in your answer.`;
    const message: TMessage = {
      role: "user",
      content: input,
    };

    const assistantMessage: TMessage = {
      role: "assistant",
      content: "",
    };

    const newMessages = [...messages, message, assistantMessage];
    setMessages(newMessages);
    setInput("");
    await createStreamingResponseWithFunctions(
      {
        messages: appendSystemPrompt(systemPrompt, newMessages).map(
          convertToMessage
        ),
        model: aiConfig.model.slug,
        temperature: aiConfig.temperature || 0.5,
        max_completion_tokens: 4000,
        response_format: { type: "json_object" },
        tools: [
          getWebsiteContent.schema,
          getClickableElements.schema,
          clickElementBySelectorTool.schema,
          fillElementBySelectorTool.schema,
          getEditableElements.schema,
          createCreateTool.schema,
          createTaskTool.schema,
        ],
        functionMap: createToolsMap([
          getWebsiteContent,
          getClickableElements,
          clickElementBySelectorTool,
          fillElementBySelectorTool,
          getEditableElements,
          createCreateTool,
          createTaskTool,
        ]),
        apiKey,
      },
      (chunk) => {
        setMessages((prevMessages) => {
          return prevMessages.map((m, index, arr) => {
            if (
              m.role === "assistant" &&
              index === arr.map((msg) => msg.role).lastIndexOf("assistant")
            ) {
              return {
                ...m,
                content: m.content + (chunk.choices[0].delta.content || ""),
              };
            }
            return m;
          });
        });
      }
    );
  };

  const saveConversation = async () => {
    console.log("SAVING CONVERSATIONS");
    
    if (!conversation) return;

    const newConversations = conversations.map((c) =>
      c.id === conversation.id
        ? { ...c, ...conversation, messages: messages }
        : c
    );
    let conversationIndex = newConversations.findIndex(
      (c) => c.id === conversation.id
    );
    if (conversationIndex === -1) {
      newConversations.push({ ...conversation, messages: messages });
      conversationIndex = newConversations.length - 1;
    }

    setConversations(newConversations);

    if (conversation && !Boolean(conversation.title) && messages.length >= 3) {
      const title = await generateConversationTitle(
        messages.map((m) => m.content).join("\n"),
        apiKey
      );
      if (title) {
        newConversations[conversationIndex] = {
          ...newConversations[conversationIndex],
          title,
        };
        setConversations(newConversations);

        await ChromeStorageManager.add("conversations", newConversations);
      }
    } else {
      await ChromeStorageManager.add("conversations", newConversations);
    }
  };

  const deleteConversation = (conversation: TConversation) => {
    const newConversations = conversations.filter(
      (c) => c.id !== conversation.id
    );
    setConversations(newConversations);
    ChromeStorageManager.add("conversations", newConversations);
  };

  const loadConversation = (conversation: TConversation) => {
    console.log(conversation, "conversation from loadConversation");

    setMessages(conversation.messages);
    setConversation(conversation);
    setActiveTab("chat");
  };

  const deleteAttachment = (attachment: TAttachment) => {
    const newAttachments = attachments.filter((a) => a.url !== attachment.url);
    setAttachments(newAttachments);
  };

  return (
    <Section
      className="bg-gradient"
      headerLeft={<h3 className="font-mono">{t("AI")}</h3>}
      headerRight={
        <>
          {!aiConfig.autoSaveConversations && (
            <Button
              className="padding-5 "
              title={t("saveConversation")}
              onClick={saveConversation}
              svg={SVGS.save}
            />
          )}
          <Button
            className="padding-5"
            title={t("newConversation")}
            onClick={createNewConversation}
            svg={SVGS.plus}
          />

          <Button
            className={`padding-5 ${
              activeTab === "history" ? "bg-active" : ""
            }`}
            onClick={() => setActiveTab("history")}
            svg={SVGS.chat}
            title={t("showConversations")}
          />

          <Button
            className={`padding-5 ${activeTab === "prompts" ? "bg-active" : ""}`}
            onClick={() => setActiveTab("prompts")}
            svg={SVGS.pin}
            title={t("savedPrompts")}
          />
          <Button
            className={`padding-5 ${activeTab === "config" ? "bg-active" : ""}`}
            onClick={() => setActiveTab("config")}
            svg={SVGS.gear}
            title={t("showConfig")}
          />
        </>
      }
    >
      {activeTab === "prompts" && (
        <PromptsPanel
          prompts={prompts}
          savePrompts={savePrompts}
          close={() => setActiveTab("chat")}
          onUsePrompt={applySavedPrompt}
        />
      )}
      {activeTab === "history" && (
        <History
          conversations={conversations}
          setConversations={setConversations}
          deleteConversation={deleteConversation}
          loadConversation={loadConversation}
          close={() => setActiveTab("chat")}
        />
      )}
      {activeTab === "config" && (
        <AIConfig
          key={aiConfig.systemPrompt}
          aiConfig={aiConfig}
          updateAiConfig={updateAiConfig}
          close={() => setActiveTab("chat")}
        />
      )}
      {activeTab === "chat" && (
        <div className="flex-column w-100 gap-10 chat-container">
          {error && <div className="bg-danger">{error}</div>}

          <section className="flex-row gap-10"></section>
          <section className="flex-column gap-10 chat-messages">
            {messages.map((message, index) => (
              <Message key={index} message={message} />
            ))}
          </section>

          <div className="flex-row gap-10">
            {attachments.map((a) => {
              return (
                <div key={a.url} className="flex-row gap-10">
                  <span>{a.name}</span>
                  <Button
                    className="padding-5"
                    svg={SVGS.trash}
                    onClick={() => deleteAttachment(a)}
                  />
                </div>
              );
            })}
          </div>
          <VariableFillerModal
            prompt={promptPicker.selected}
            values={promptPicker.variableValues}
            onChangeValues={(values) => setPromptPicker((prev) => ({ ...prev, variableValues: values }))}
            onUse={(filled) => {
              setInput(filled);
              setPromptPicker({ selected: null, variableValues: {} });
            }}
            onClose={() =>
              setPromptPicker({ selected: null, variableValues: {} })
            }
          />

          <VariableFillerModal
            prompt={pinnedFiller?.prompt ?? null}
            values={pinnedFiller?.values ?? {}}
            onChangeValues={(values) => setPinnedFiller((prev) => prev && ({ ...prev, values }))}
            onUse={(filled) => {
              setInput(filled);
              setPinnedFiller(null);
            }}
            onClose={() => setPinnedFiller(null)}
          />

          {prompts.filter((p) => p.pinned).length > 0 && (
            <Group gap="xs" px="xs">
              {prompts.filter((p) => p.pinned).map((p) => {
                const initials = p.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0].toUpperCase())
                  .join("");
                return (
                  <Tooltip key={p.id} label={p.name} withArrow>
                    <ActionIcon
                      variant="default"
                      size="md"
                      style={{ fontWeight: 600, fontSize: "0.7rem", letterSpacing: "0.05em" }}
                      onClick={() => {
                        const vars = extractVariables(p.content);
                        if (vars.length === 0) {
                          setInput(p.content);
                        } else {
                          const initial: Record<string, string> = {};
                          vars.forEach((v) => (initial[v] = ""));
                          setPinnedFiller({ prompt: p, values: initial });
                        }
                      }}
                    >
                      {initials}
                    </ActionIcon>
                  </Tooltip>
                );
              })}
            </Group>
          )}

          <section className="flex-row gap-10 w-100 padding-5 ">
            <div className="w-100">
              <AIInput
                value={input}
                onChange={setInput}
                onSubmit={handleSendMessage}
                placeholder={t("commandOrPrompt")}
                autoFocus
                multiline
              />
            </div>

            <div className="flex-column gap-5 floating-buttons">
            </div>
          </section>
        </div>
      )}
    </Section>
  );
};

type TReasoningTag = "thinking" | "reasoning" | "thinking_process";
type TAIConfig = {
  systemPrompt: string;
  model: TModel;
  autoSaveConversations: boolean;
  setTitleAtMessage?: number;
  temperature?: number;
  reasoningTag?: TReasoningTag;
};

const AIConfig = ({
  aiConfig,
  updateAiConfig,
  close,
}: {
  aiConfig: TAIConfig;
  updateAiConfig: (newConfig: TAIConfig) => void;
  close: () => void;
}) => {
  const { t } = useTranslation();
  const [_aiConfig, setAiConfig] = useState<TAIConfig>(aiConfig);

  const [ models, setModels ] = useState<TModel[]>([]);

  const finishConfig = () => {
    updateAiConfig({ ..._aiConfig });
  };

  useEffect(() => {
    const getModels = async () => {
      const apiKey = await ChromeStorageManager.get("openaiApiKey");  
      if (!apiKey) {
        toast.error(t("noApiKeyError"));
        return;
      }
      const models = await listModels(apiKey as string);
      setModels(models);
    };
    getModels();
  }, []);

  console.log(aiConfig, "aiConfig");

  return (
    <Section
      className="bg-gradient"
      headerLeft={<h3 className="font-mono">{t("chatConfig")}</h3>}
      close={close}
    >
      <Stack p="md" gap="lg">
        <Stack gap="xs">
          <Title order={5}>{t("systemPrompt")}</Title>
          <MantineTextarea
            variant="filled"
            defaultValue={_aiConfig.systemPrompt}
            autosize
            minRows={4}
            maxRows={10}
            onChange={(e) => setAiConfig({ ..._aiConfig, systemPrompt: e.target.value })}
          />
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Title order={5}>{t("model")}</Title>
          <MantineSelect
            variant="filled"
            data={models.map((m) => ({ label: m.name, value: m.slug }))}
            value={_aiConfig.model.slug}
            onChange={(value) => {
              const model = models.find((m) => m.slug === value);
              if (model) setAiConfig({ ..._aiConfig, model });
            }}
            searchable
          />
        </Stack>

        <Stack gap="xs">
          <Group justify="space-between">
            <Title order={5}>Temperature</Title>
            <Text size="sm" c="dimmed">{(_aiConfig.temperature ?? 0.5).toFixed(1)}</Text>
          </Group>
          <Slider
            min={0} max={2} step={0.1}
            value={_aiConfig.temperature ?? 0.5}
            onChange={(v) => setAiConfig({ ..._aiConfig, temperature: v })}
            marks={[{ value: 0, label: "0" }, { value: 1, label: "1" }, { value: 2, label: "2" }]}
          />
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Title order={5}>{t("conversationsConfig")}</Title>
          <Switch
            label={t("autoSaveConversations")}
            checked={_aiConfig.autoSaveConversations}
            onChange={(e) => setAiConfig({ ..._aiConfig, autoSaveConversations: e.target.checked })}
          />
        </Stack>

        <MantineButton fullWidth leftSection={SVGS.save} onClick={finishConfig}>
          {t("finishConfig")}
        </MantineButton>
      </Stack>
    </Section>
  );
};

const History = ({
  conversations,
  setConversations,
  deleteConversation,
  loadConversation,
  close,
}: {
  conversations: TConversation[];
  setConversations: (conversations: TConversation[]) => void;
  deleteConversation: (conversation: TConversation) => void;
  loadConversation: (conversation: TConversation) => void;
  close: () => void;
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const sortedConversations = useMemo(
    () =>
      [...conversations].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [conversations]
  );

  const selectedCount = selectedIds.size;
  const allSelected =
    sortedConversations.length > 0 &&
    selectedCount === sortedConversations.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sortedConversations.map((c) => c.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    if (
      !window.confirm(
        t("deleteSelectedConversationsConfirm").replace("%s", String(n))
      )
    ) {
      return;
    }
    const next = conversations.filter((c) => !selectedIds.has(c.id));
    setConversations(next);
    void ChromeStorageManager.add("conversations", next);
    setSelectedIds(new Set());
    toast.success(
      t("bulkConversationsDeleted").replace("%s", String(n)),
      { icon: "✅" }
    );
  };

  return (
    <Section
      className="bg-gradient"
      headerLeft={<h3 className="font-mono">{t("history")}</h3>}
      headerRight={
        <>
          {sortedConversations.length > 0 && !allSelected ? (
            <Button
              className="justify-center padding-5"
              text={t("selectAll")}
              title={t("selectAll")}
              onClick={selectAll}
            />
          ) : null}
          {selectedCount > 0 ? (
            <>
              <Button
                className="justify-center padding-5"
                text={t("clearSelection")}
                title={t("clearSelection")}
                onClick={clearSelection}
              />
              <Button
                className="justify-center padding-5"
                text={t("deleteSelected")}
                title={t("deleteSelected")}
                svg={SVGS.trash}
                onClick={deleteSelected}
              />
            </>
          ) : null}
        </>
      }
      close={close}
    >
      <div className="flex-column gap-10 padding-10">
        {sortedConversations.map((conversation) => {
          const isSelected = selectedIds.has(conversation.id);
          return (
            <div
              key={conversation.id}
              className={`flex-row gap-10 padding-10 rounded align-start w-100 ${
                isSelected ? "border-active" : "border-gray"
              }`}
            >
              <input
                type="checkbox"
                className="checkbox"
                style={{ marginTop: 6, flexShrink: 0 }}
                checked={isSelected}
                onChange={() => toggleSelect(conversation.id)}
                aria-label={t("selectConversation")}
                onClick={(e) => e.stopPropagation()}
              />
              <div
                className="flex-column gap-5"
                style={{ flex: 1, minWidth: 0 }}
              >
                <h3
                  contentEditable={true}
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const newTitle = e.target.innerText;
                    if (!newTitle || newTitle === conversation.title) return;

                    const newConversations = conversations.map((c) =>
                      c.id === conversation.id ? { ...c, title: newTitle } : c
                    );
                    setConversations(newConversations);
                    ChromeStorageManager.add("conversations", newConversations);
                    toast.success(t("conversationSaved"), {
                      icon: "✅",
                    });
                  }}
                >
                  {conversation.title || t("untitledConversation")}
                </h3>
                <div className="flex-row gap-10 justify-between w-100 align-center">
                  <p className="text-mini color-gray" style={{ margin: 0 }}>
                    {new Date(conversation.date).toLocaleString()}
                  </p>
                  <div className="flex-row gap-10">
                    <Button
                      className="padding-5"
                      onClick={() => deleteConversation(conversation)}
                      svg={SVGS.trash}
                      title={t("deleteConversation")}
                      confirmations={[
                        { text: t("sure?"), className: "bg-danger" },
                      ]}
                    />
                    <Button
                      className="padding-5"
                      onClick={() => loadConversation(conversation)}
                      svg={SVGS.expand}
                      title={t("loadConversation")}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
};

const PromptsPanel = ({
  prompts,
  savePrompts,
  close,
  onUsePrompt,
}: {
  prompts: TPrompt[];
  savePrompts: (prompts: TPrompt[]) => void;
  close: () => void;
  onUsePrompt: (p: TPrompt) => void;
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<TPrompt | null>(null);
  const [form, setForm] = useState<{ name: string; content: string }>({ name: "", content: "" });

  const startNew = () => {
    setEditing({ id: generateRandomId("prompt"), name: "", content: "" });
    setForm({ name: "", content: "" });
  };

  const startEdit = (p: TPrompt) => {
    setEditing(p);
    setForm({ name: p.name, content: p.content });
  };

  const commitEdit = () => {
    if (!editing) return;
    const updated = { ...editing, ...form };
    const exists = prompts.find((p) => p.id === updated.id);
    savePrompts(exists ? prompts.map((p) => (p.id === updated.id ? updated : p)) : [...prompts, updated]);
    setEditing(null);
  };

  const deletePrompt = (id: string) => savePrompts(prompts.filter((p) => p.id !== id));

  const variables = editing ? extractVariables(form.content) : [];

  return (
    <Section
      className="bg-gradient"
      headerLeft={<h3 className="font-mono">{t("savedPrompts")}</h3>}
      headerRight={
        <Button className="padding-5" svg={SVGS.plus} title={t("newPrompt")} onClick={startNew} />
      }
      close={close}
    >
      <div className="flex-column gap-10 padding-10">
        {editing ? (
          <div className="flex-column gap-10">
            <input
              className="input rounded padding-5"
              placeholder={t("promptName")}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
            <textarea
              className="input rounded padding-5"
              placeholder={t("promptContent")}
              rows={6}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              style={{ resize: "vertical", fontFamily: "inherit", color: "var(--font-color)", background: "transparent" }}
            />
            {variables.length > 0 && (
              <p className="text-mini color-gray">
                {t("detectedVariables")}: {variables.map((v) => <span key={v} className="tag" style={{ marginRight: 4 }}>{`{{${v}}}`}</span>)}
              </p>
            )}
            <div className="flex-row gap-5">
              <Button className="w-100 justify-center padding-5 active-on-hover" svg={SVGS.save} text={t("save")} onClick={commitEdit} />
              <Button className="padding-5" svg={SVGS.close} onClick={() => setEditing(null)} />
            </div>
          </div>
        ) : prompts.length === 0 ? (
          <p className="color-gray text-mini">{t("noSavedPrompts")}</p>
        ) : (
          prompts.map((p) => (
            <div key={p.id} className="flex-column gap-5 border-gray rounded-10 padding-10">
              <div className="flex-row align-center justify-between">
                <h4>{p.name}</h4>
                <div className="flex-row gap-5 align-center">
                  <Button
                    className="padding-5 justify-center active-on-hover"
                    text={t("use")}
                    title={t("use")}
                    onClick={() => onUsePrompt(p)}
                  />
                  <Button
                    className={`padding-5 ${p.pinned ? "bg-active" : ""}`}
                    svg={SVGS.pin}
                    title={p.pinned ? t("unpin") : t("pin")}
                    onClick={() => savePrompts(prompts.map((x) => x.id === p.id ? { ...x, pinned: !x.pinned } : x))}
                  />
                  <Button className="padding-5" svg={SVGS.edit} onClick={() => startEdit(p)} />
                  <Button
                    className="padding-5"
                    svg={SVGS.trash}
                    confirmations={[{ text: t("sure?"), className: "bg-danger" }]}
                    onClick={() => deletePrompt(p.id)}
                  />
                </div>
              </div>
              <p className="text-mini color-gray" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{p.content}</p>
              {extractVariables(p.content).length > 0 && (
                <p className="text-mini color-gray">{t("variables")}: {extractVariables(p.content).join(", ")}</p>
              )}
            </div>
          ))
        )}
      </div>
    </Section>
  );
};

const VariableFillerModal = ({
  prompt,
  values,
  onChangeValues,
  onUse,
  onClose,
}: {
  prompt: TPrompt | null;
  values: Record<string, string>;
  onChangeValues: (values: Record<string, string>) => void;
  onUse: (filled: string) => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  if (!prompt) return null;
  return (
    <Modal
      opened={!!prompt}
      onClose={onClose}
      title={<Text fw={600}>{prompt.name}</Text>}
      centered
      size="md"
    >
      <Stack gap="sm">
        {Object.keys(values).map((varName, i) => (
          <TextInput
            key={varName}
            label={varName}
            variant="filled"
            autoFocus={i === 0}
            value={values[varName]}
            onChange={(e) => onChangeValues({ ...values, [varName]: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") onUse(fillVariables(prompt.content, values));
            }}
          />
        ))}
        <MantineButton
          fullWidth
          mt="xs"
          leftSection={<IconCheck size={14} />}
          onClick={() => onUse(fillVariables(prompt.content, values))}
        >
          {t("use")}
        </MantineButton>
      </Stack>
    </Modal>
  );
};

const extractReasoning = (content: string, tagName: string = "thinking") => {
  const regex = new RegExp(`<${tagName}>([\s\S]*?)<\/${tagName}>`);
  const match = content.match(regex);
  return match ? match[1] : null;
};

export const Message = ({ message }: { message: TMessage }) => {
  const { t } = useTranslation();
  const [showReasoning, setShowReasoning] = useState(false);
  if (message.hidden) return null;
  return (
    <div className={`message ${message.role}`}>
      {extractReasoning(message.content) && (
        <div
          className={`flex-column gap-5  rounded padding-5 ${
            showReasoning ? "border-gray" : ""
          }`}
        >
          <h4
            className="flex-row gap-5 align-center justify-between"
            onClick={() => setShowReasoning(!showReasoning)}
          >
            <span>{t("reasoning")}</span>
            <Button
              svg={showReasoning ? SVGS.close : SVGS.thought}
              onClick={() => setShowReasoning(!showReasoning)}
            />
          </h4>
          {showReasoning && (
            <StyledMarkdown
              markdown={extractReasoning(message.content) || ""}
            />
          )}
        </div>
      )}
      <StyledMarkdown markdown={message.content} />
    </div>
  );
};

// interface Action {
//   component: ReactNode;
//   label: string;
//   description: string;
// }

// interface QuickActionsProps {
//   actions: Action[];
//   onCommandChange: (command: string) => void;
// }

// const QuickActions = ({ actions, onCommandChange }: QuickActionsProps) => {
//   const { t } = useTranslation();
//   const [command, setCommand] = useState("");
//   return (
//     <div>
//       <Textarea
//         label={t("command")}
//         name="command"
//         className="w-100"
//         defaultValue={command}
//         onChange={(value) => {
//           setCommand(value);
//           onCommandChange(value);
//         }}
//       />
//     </div>
//   );
// };
