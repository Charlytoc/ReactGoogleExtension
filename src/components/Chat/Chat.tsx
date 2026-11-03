import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  convertToMessage,
  createCompletion,
  listModels,
} from "../../utils/ai";
import { MODEL_CHAT_SMALL } from "../../utils/models";
import {
  createDefaultAiConfig,
  getAiConfig as loadAiConfig,
  saveAiConfig,
} from "../../utils/aiConfigStorage";
import { ChromeStorageManager } from "../../managers/Storage";
import { Button } from "../Button/Button";
import { TChatAttachment, TMessage } from "../../types";
import { extractVariables, fillVariables } from "../../utils/promptVariables";
import { SVGS } from "../../assets/svgs";
import "./Chat.css";
import { StyledMarkdown } from "../RenderMarkdown/StyledMarkdown";
import { PreviewImage } from "../RenderMarkdown/RenderMarkdown";
import { generateRandomId } from "../../utils/lib";
import { notify } from "../../utils/chromeFunctions";
import { TConversation, TModel, TAIConfig } from "../../types";
import {
  AI_CHAT_JOBS_KEY,
  deleteChatJob,
  enqueueChatJob,
  getChatJobs,
  getLastMainConversationId,
  isChatJobStale,
  setLastMainConversationId,
  type TChatJobMap,
} from "../../utils/chatJobs";
import {
  CONVERSATIONS_STORAGE_KEY,
  createMainConversation,
  deleteConversationsByIds,
  getMainConversations,
  loadAllConversations,
  saveMainConversation,
  updateConversationTitle,
} from "../../utils/conversationsStorage";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Section } from "../Section/Section";
import { AIInput } from "../AIInput/AIInput";
import { ActionIcon, Button as MantineButton, Divider, Group, Modal, Select as MantineSelect, Stack, Switch, Text, Textarea as MantineTextarea, TextInput, Title, Tooltip } from "@mantine/core";
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
  const title = await createCompletion({
    model: MODEL_CHAT_SMALL,
    messages: messages.map(convertToMessage),
    max_completion_tokens: 4000,
    response_format: { type: "text" },
    apiKey,
  });
  return title;
};

const defaultMessages: TMessage[] = [
  { role: "system", content: "You are a helpful assistant." },
];

const readFileAsAttachment = (file: File): Promise<TChatAttachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: generateRandomId("attachment"),
        name: file.name || "pasted-file",
        mimeType: file.type || "application/octet-stream",
        dataUrl: String(reader.result ?? ""),
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

type TChatTab = "history" | "config" | "chat" | "prompts";

type TPrompt = {
  id: string;
  name: string;
  content: string;
  pinned?: boolean;
};

const getPageTab = (): Promise<{ tabId?: number; pageUrl?: string }> => {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) {
      resolve({});
      return;
    }
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve({});
        return;
      }
      const tab = tabs[0];
      const pageUrl = tab?.url || tab?.pendingUrl || "";
      if (
        tab?.id == null ||
        !pageUrl ||
        pageUrl.startsWith("chrome-extension://") ||
        pageUrl.startsWith("chrome://")
      ) {
        resolve({});
        return;
      }
      resolve({ tabId: tab.id, pageUrl });
    });
  });
};

export const Chat = () => {
  const [messages, setMessages] = useState<TMessage[]>(defaultMessages);
  const [conversation, setConversation] = useState<TConversation | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [aiConfig, setAiConfig] = useState<TAIConfig>(createDefaultAiConfig());
  const [activeTab, setActiveTab] = useState<TChatTab>("chat");
  const [conversations, setConversations] = useState<TConversation[]>([]);
  const [error, setError] = useState<string>("");
  const [attachments, setAttachments] = useState<TChatAttachment[]>([]);
  const [prompts, setPrompts] = useState<TPrompt[]>([]);
  const [isChatPending, setIsChatPending] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const chatPendingRef = useRef(false);
  const skipSaveRef = useRef(false);
  const conversationReadyRef = useRef(false);
  const sendLockRef = useRef(false);
  const handleSendMessageRef = useRef<() => Promise<void>>(async () => {});
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
      void handleSendMessageRef.current();
    }
  }, [input]);

  useEffect(() => {
    if (!conversationReadyRef.current || chatPendingRef.current) return;
    const systemMessageIndex = messages.findIndex(
      (message) => message.role === "system"
    );
    if (systemMessageIndex === -1) {
      setMessages([
        ...messages,
        { role: "system", content: aiConfig.systemPrompt },
      ]);
      return;
    }
    if (messages[systemMessageIndex].content === aiConfig.systemPrompt) return;
    const newMessages = messages.map((message) => {
      if (message.role === "system") {
        return { ...message, content: aiConfig.systemPrompt };
      }
      return message;
    });
    setMessages(newMessages);
  }, [aiConfig.systemPrompt]);

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
    } else if (!chatPendingRef.current && aiConfig.autoSaveConversations) {
      saveConversation();
    }
    if (autoScroll) {
      const chatMessages = document.querySelector(".chat-messages");
      if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;

      if (changes[CONVERSATIONS_STORAGE_KEY]) {
        const all = (changes[CONVERSATIONS_STORAGE_KEY].newValue ??
          []) as TConversation[];
        const main = getMainConversations(Array.isArray(all) ? all : []);
        setConversations(main);
        const id = conversationIdRef.current;
        const updated = id ? main.find((item) => item.id === id) : undefined;
        if (updated) {
          skipSaveRef.current = true;
          setConversation(updated);
          setMessages(updated.messages);
        }
      }

      if (!changes[AI_CHAT_JOBS_KEY]) return;
      const id = conversationIdRef.current;
      if (!id) return;
      const nextJobs = (changes[AI_CHAT_JOBS_KEY].newValue ?? {}) as TChatJobMap;
      const prevJobs = (changes[AI_CHAT_JOBS_KEY].oldValue ?? {}) as TChatJobMap;
      const job = nextJobs[id];
      const prevJob = prevJobs[id];

      if (!job && prevJob?.status === "pending") {
        chatPendingRef.current = false;
        setIsChatPending(false);
        toast.success(t("chatDone"));
        return;
      }
      if (job?.status === "error" && prevJob?.status !== "error") {
        chatPendingRef.current = false;
        setIsChatPending(false);
        toast.error(job.error || t("chatFailed"));
        return;
      }
      if (job?.status === "pending" && !isChatJobStale(job)) {
        chatPendingRef.current = true;
        setIsChatPending(true);
      }
    };

    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, [t]);

  const getApiKey = async () => {
    const apiKey = await ChromeStorageManager.get("openaiApiKey");
    if (!apiKey) {
      setError("No API key found");
    }

    setApiKey(apiKey);
  };

  const getAiConfig = async () => {
    const config = await loadAiConfig();
    setAiConfig(config);
  };

  const updateAiConfig = async (newConfig: TAIConfig) => {
    setAiConfig(newConfig);
    await saveAiConfig(newConfig);
    notify(t("aiConfigUpdated"), "✅");
    setActiveTab("chat");
  };

  const showConversation = (
    next: TConversation,
    pending: boolean
  ) => {
    conversationIdRef.current = next.id;
    conversationReadyRef.current = true;
    chatPendingRef.current = pending;
    setIsChatPending(pending);
    skipSaveRef.current = true;
    setConversation(next);
    setMessages(next.messages.length > 0 ? next.messages : defaultMessages);
  };

  const createNewConversation = async () => {
    const newConversation = createMainConversation();
    conversationIdRef.current = newConversation.id;
    conversationReadyRef.current = true;
    chatPendingRef.current = false;
    setIsChatPending(false);
    setConversation(newConversation);
    setMessages([{ role: "system", content: aiConfig.systemPrompt }]);
  };

  const getConversations = async () => {
    const all = await loadAllConversations();
    const mainConversations = getMainConversations(all);
    const jobs = await getChatJobs();
    const pendingJob = Object.values(jobs).find(
      (job) => job.status === "pending" && !isChatJobStale(job)
    );

    if (mainConversations.length === 0) {
      setConversations([]);
      conversationReadyRef.current = true;
      createNewConversation();
      return;
    }

    setConversations(mainConversations);

    const pendingConversation = pendingJob
      ? mainConversations.find(
          (item) => item.id === pendingJob.conversationId
        )
      : undefined;
    if (pendingConversation) {
      showConversation(pendingConversation, true);
      return;
    }

    const lastId = await getLastMainConversationId();
    const lastConversation = mainConversations.find((item) => item.id === lastId);
    if (lastConversation) {
      showConversation(lastConversation, false);
      return;
    }

    const conversation = mainConversations.find((c) => c.messages.length <= 1);
    if (conversation) {
      showConversation(conversation, false);
      return;
    }
    conversationReadyRef.current = true;
    createNewConversation();
  };

  const addFiles = async (files: File[]) => {
    const next = await Promise.all(files.map(readFileAsAttachment));
    setAttachments((current) => [...current, ...next]);
  };

  const handleSendMessage = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && attachments.length === 0) return;
    if (sendLockRef.current || chatPendingRef.current) return;
    if (!apiKey) {
      setError("No API key found");
      return;
    }

    sendLockRef.current = true;
    const previousMessages = messages;
    const previousInput = input;
    const previousAttachments = attachments;
    let current = conversation ?? createMainConversation();
    conversationIdRef.current = current.id;
    conversationReadyRef.current = true;
    chatPendingRef.current = true;
    setIsChatPending(true);

    const message: TMessage = {
      role: "user",
      content: trimmedInput,
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    const nextMessages = [...messages, message];
    skipSaveRef.current = true;
    setConversation(current);
    setMessages(nextMessages);
    setInput("");
    setAttachments([]);

    try {
      const nextMain = await saveMainConversation(current, nextMessages);
      const saved =
        nextMain.find((item) => item.id === current.id) ?? {
          ...current,
          messages: nextMessages,
        };
      setConversations(nextMain);
      setConversation(saved);
      current = saved;
      const page = await getPageTab();
      await enqueueChatJob({
        conversationId: current.id,
        tabId: page.tabId,
        pageUrl: page.pageUrl,
      });
    } catch (error) {
      console.error("Error starting chat job:", error);
      chatPendingRef.current = false;
      setIsChatPending(false);
      skipSaveRef.current = true;
      setMessages(previousMessages);
      setInput(previousInput);
      setAttachments(previousAttachments);
      toast.error(t("chatFailed"));
    } finally {
      sendLockRef.current = false;
    }
  };
  handleSendMessageRef.current = handleSendMessage;

  const saveConversation = async () => {
    if (!conversation) return;

    let updatedConversation: TConversation = { ...conversation, messages };

    if (!conversation.title && messages.length >= 3) {
      const title = await generateConversationTitle(
        messages.map((m) => m.content).join("\n"),
        apiKey
      );
      if (title) {
        updatedConversation = { ...updatedConversation, title };
      }
    }

    const nextMain = await saveMainConversation(updatedConversation, messages);
    setConversations(nextMain);
    setConversation(updatedConversation);
  };

  const deleteConversation = async (target: TConversation) => {
    const nextMain = await deleteConversationsByIds([target.id]);
    await deleteChatJob(target.id);
    setConversations(nextMain);
    if (conversationIdRef.current === target.id) {
      chatPendingRef.current = false;
      setIsChatPending(false);
    }
  };

  const loadConversation = (next: TConversation) => {
    conversationIdRef.current = next.id;
    void setLastMainConversationId(next.id);
    void getChatJobs().then((jobs) => {
      const job = jobs[next.id];
      const pending = !!job && job.status === "pending" && !isChatJobStale(job);
      if (conversationIdRef.current !== next.id) return;
      chatPendingRef.current = pending;
      setIsChatPending(pending);
    });
    skipSaveRef.current = true;
    setMessages(next.messages);
    setConversation(next);
    setActiveTab("chat");
  };

  const deleteAttachment = (attachment: TChatAttachment) => {
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
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
            {isChatPending && (
              <div className="padding-10 text-secondary">{t("chatWorking")}</div>
            )}
          </section>

          {attachments.length > 0 && (
            <div className="flex-row gap-10 chat-pending-files">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="chat-attachment">
                  {attachment.mimeType.startsWith("image/") ? (
                    <img src={attachment.dataUrl} alt={attachment.name} />
                  ) : (
                    <span>{attachment.name}</span>
                  )}
                  <Button
                    className="padding-5"
                    svg={SVGS.trash}
                    onClick={() => deleteAttachment(attachment)}
                  />
                </div>
              ))}
            </div>
          )}
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
                onAttachFiles={addFiles}
                placeholder={t("commandOrPrompt")}
                autoFocus
                multiline
                isLoading={isChatPending}
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

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    if (
      !window.confirm(
        t("deleteSelectedConversationsConfirm").replace("%s", String(n))
      )
    ) {
      return;
    }
    const next = await deleteConversationsByIds(selectedIds);
    setConversations(next);
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
      close={close}
    >
      <div className="flex-column gap-10 padding-10">
        {sortedConversations.length > 0 && (
          <div className="history-bulk-actions">
            {!allSelected && (
              <Button
                className="justify-center padding-5"
                text={t("selectAll")}
                title={t("selectAll")}
                onClick={selectAll}
              />
            )}
            {selectedCount > 0 && (
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
            )}
          </div>
        )}
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
                  onBlur={async (e) => {
                    const newTitle = e.target.innerText;
                    if (!newTitle || newTitle === conversation.title) return;

                    await updateConversationTitle(conversation.id, newTitle);
                    const newConversations = conversations.map((c) =>
                      c.id === conversation.id ? { ...c, title: newTitle } : c
                    );
                    setConversations(newConversations);
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
      {(message.attachments ?? []).map((attachment) => (
        <div key={attachment.id} className="message-attachment">
          {attachment.mimeType.startsWith("image/") ? (
            <PreviewImage src={attachment.dataUrl} alt={attachment.name} />
          ) : (
            <span>{attachment.name}</span>
          )}
        </div>
      ))}
      {message.content && <StyledMarkdown markdown={message.content} />}
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
