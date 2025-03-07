import { useEffect, useState } from "react";
import {
  convertToMessage,
  createCompletion,
  // createStreamingResponse,
  createStreamingResponseWithFunctions,
  createToolsMap,
  toolify,
} from "../../utils/ai";
import { Textarea } from "../Textarea/Textarea";
import { ChromeStorageManager } from "../../managers/Storage";
import { Button } from "../Button/Button";
import { TMessage } from "../../types";
import { SVGS } from "../../assets/svgs";
import "./Chat.css";
import { StyledMarkdown } from "../RenderMarkdown/StyledMarkdown";
import {
  cacheLocation,
  clickElementBySelector,
  extractClickableElements,
  extractEditableElements,
  extractPageData,
  fillElementBySelector,
  generateRandomId,
} from "../../utils/lib";
import { useNavigate } from "react-router";
import { notify } from "../../utils/chromeFunctions";
import { TConversation, TModel } from "../../types";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Section } from "../Section/Section";

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
      model: "gpt-4o-mini",
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

type TChatTab = "history" | "config" | "chat";

export const Chat = () => {
  const [messages, setMessages] = useState<TMessage[]>(defaultMessages);
  const [conversation, setConversation] = useState<TConversation | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [aiConfig, setAiConfig] = useState<TAIConfig>({
    systemPrompt: "You are a helpful assistant.",
    model: { name: "gpt-4o-mini", slug: "gpt-4o-mini", hasReasoning: false },
    autoSaveConversations: false,
    setTitleAtMessage: 0,
  });
  const [activeTab, setActiveTab] = useState<TChatTab>("chat");
  const [conversations, setConversations] = useState<TConversation[]>([]);
  const [error, setError] = useState<string>("");
  const [attachments, setAttachments] = useState<TAttachment[]>([]);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    getApiKey();
    getConversations();
    getAiConfig();
  }, []);

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
  }, [messages]);

  useEffect(() => {
    ChromeStorageManager.add("conversations", conversations);
  }, [conversations]);

  const getApiKey = async () => {
    const apiKey = await ChromeStorageManager.get("openaiApiKey");
    if (!apiKey) {
      setError("No API key found");
    }

    setApiKey(apiKey);
  };

  const getAiConfig = async () => {
    const { url } = await extractPageData();
    let aiConfig: TAIConfig = await ChromeStorageManager.get("aiConfig");
    if (!aiConfig) {
      aiConfig = {
        systemPrompt: `You are a helpful assistant. You are currently on the website ${url}.`,
        model: {
          name: "gpt-4o-mini",
          slug: "gpt-4o-mini",
          hasReasoning: false,
        },
        autoSaveConversations: false,
        setTitleAtMessage: 0,
      };
    }
    aiConfig.systemPrompt += `\n\nCurrent URL: ${url}`;
    setAiConfig(aiConfig);
  };

  const updateAiConfig = async (newConfig: TAIConfig) => {
    setAiConfig(newConfig);
    await ChromeStorageManager.add("aiConfig", newConfig);
    notify(t("aiConfigUpdated"), "✅");
    setActiveTab("chat");
  };

  const createNewConversation = () => {
    const newConversation: TConversation = {
      id: generateRandomId("conversation"),
      messages: [],
      title: "",
      date: new Date().toISOString(),
    };
    setConversation(newConversation);
  };

  const getConversations = async () => {
    const conversations: TConversation[] = await ChromeStorageManager.get(
      "conversations"
    );
    setConversations(conversations);

    console.log("conversations", conversations);

    // Find a conversation with only one message or no messages (the system message)
    const conversation = conversations.find((c) => c.messages.length <= 1);
    if (conversation) {
      setConversation(conversation);
    } else {
      createNewConversation();
    }
  };

  const addAttachment = (attachment: TAttachment) => {
    setAttachments([...attachments, attachment]);
  };

  const uploadFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const attachment: TAttachment = {
        url: e.target?.result as string,
        content: "",
        type: "file",
        name: file.name,
      };
      addAttachment(attachment);
    };
    reader.readAsDataURL(file);
  };

  const getWebsiteContent = toolify(
    async () => {
      const { url, content } = await extractPageData();
      return JSON.stringify({ url, content });
    },
    "getWebsiteContent",
    "Get the content of the current website",
    {}
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

  const handleSendMessage = async () => {
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

    createStreamingResponseWithFunctions(
      {
        messages: newMessages.map(convertToMessage),
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
        ],
        functionMap: createToolsMap([
          getWebsiteContent,
          getClickableElements,
          clickElementBySelectorTool,
          fillElementBySelectorTool,
          getEditableElements,
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
    if (!conversation) return;

    const newConversations = conversations.map((c) =>
      c.id === conversation.id
        ? { ...c, ...conversation, messages: messages }
        : c
    );
    // find if the conversation is already in the list
    let conversationIndex = newConversations.findIndex(
      (c) => c.id === conversation.id
    );
    if (conversationIndex === -1) {
      newConversations.push({ ...conversation, messages: messages });
      conversationIndex = newConversations.length - 1;
    }
    setConversations(newConversations);

    if (conversation && conversation.title === "" && messages.length >= 3) {
      const title = await generateConversationTitle(
        messages.map((m) => m.content).join("\n"),
        apiKey
      );
      if (title) {
        newConversations[conversationIndex] = {
          ...conversation,
          title,
        };
        setConversations(newConversations);
      }
    }
  };

  const deleteConversation = (conversation: TConversation) => {
    const newConversations = conversations.filter(
      (c) => c.id !== conversation.id
    );
    setConversations(newConversations);
  };

  const loadConversation = (conversation: TConversation) => {
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
      close={() => {
        navigate("/index.html");
        cacheLocation("/index.html", "/chat");
      }}
      title={t("AI")}
      extraButtons={
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
            className="padding-5 "
            title={t("clickElementAtPosition")}
            onClick={async () => {
              const elements = await getClickableElements.function({});
              console.log("elements", JSON.parse(elements));

              toast.success(t("elementClicked"), {
                icon: "✅",
              });
            }}
            svg={SVGS.alarmOff}
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
            className={`padding-5 ${activeTab === "config" ? "bg-active" : ""}`}
            onClick={() => setActiveTab("config")}
            svg={SVGS.gear}
            title={t("showConfig")}
          />
        </>
      }
    >
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
          <section className="flex-row gap-10 w-100  padding-5 ">
            <div className="flex-row gap-10 w-100">
              <Textarea
                className="w-100"
                key={messages.length}
                defaultValue=""
                onChange={(value) => setInput(value)}
              />
              <div className="flex-column gap-10">
                <Button
                  className=" padding-5 align-center justify-center active-on-hover"
                  svg={SVGS.send}
                  onClick={handleSendMessage}
                />
                <Button
                  className=" padding-5 align-center justify-center active-on-hover"
                  svg={SVGS.plus}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) uploadFile(file);
                    };
                    input.click();
                  }}
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </Section>
  );
};

type TAIConfig = {
  systemPrompt: string;
  model: TModel;
  autoSaveConversations: boolean;
  setTitleAtMessage?: number;
  temperature?: number;
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

  const models: TModel[] = [
    { name: "gpt-4o", slug: "gpt-4o", hasReasoning: false },
    { name: "gpt-3.5-turbo", slug: "gpt-3.5-turbo", hasReasoning: false },
    { name: "gpt-4o-mini", slug: "gpt-4o-mini", hasReasoning: false },
    {
      name: "chatgpt-4o-latest",
      slug: "chatgpt-4o-latest",
      hasReasoning: false,
    },
    { name: "o3-mini", slug: "o3-mini", hasReasoning: true },
  ];

  const finishConfig = () => {
    updateAiConfig({ ..._aiConfig });
  };

  return (
    <Section title={t("chatConfig")} close={close}>
      <div className="flex-column gap-10">
        <Textarea
          label={t("systemPrompt")}
          // placeholder={t("systemPrompt")}
          className="w-100  padding-5 rounded"
          defaultValue={_aiConfig.systemPrompt}
          onChange={(value) => {
            setAiConfig({ ..._aiConfig, systemPrompt: value });
          }}
        />
        <div className="flex-row gap-5 align-center ">
          <h4>{t("model")}</h4>
          <select
            className="w-100 border-gray padding-5 rounded"
            value={_aiConfig.model.slug}
            onChange={(e) => {
              const model = models.find((m) => m.slug === e.target.value);
              if (model) {
                setAiConfig({ ..._aiConfig, model: model });
              }
            }}
          >
            {models.map((model) => (
              <option key={model.slug} value={model.slug}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
        <h3>{t("conversationsConfig")}</h3>
        <div className="flex-row gap-10">
          <input
            type="checkbox"
            name="autoSave-conversations"
            checked={_aiConfig.autoSaveConversations}
            onChange={(e) => {
              setAiConfig({
                ..._aiConfig,
                autoSaveConversations: e.target.checked,
              });
            }}
          />
          <span>{t("autoSaveConversations")}</span>
        </div>
        <Button
          className="w-100 padding-5 justify-center active-on-hover"
          text={t("finishConfig")}
          title={t("finishConfig")}
          svg={SVGS.save}
          onClick={finishConfig}
        />
      </div>
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

  const orderByDate = (conversations: TConversation[]) => {
    return conversations.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  };

  return (
    <Section title={t("history")} close={close}>
      {orderByDate(conversations).map((conversation, index) => (
        <div
          key={index}
          className=" padding-10 rounded pointer  flex-column gap-5"
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
            <p>{new Date(conversation.date).toLocaleString()}</p>
            <div className="flex-row gap-10">
              <Button
                className="padding-5"
                onClick={() => deleteConversation(conversation)}
                svg={SVGS.trash}
                title={t("deleteConversation")}
                confirmations={[{ text: t("sure?"), className: "bg-danger" }]}
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
      ))}
    </Section>
  );
};

export const Message = ({ message }: { message: TMessage }) => {
  if (message.hidden) return null;
  return (
    <div className={`message ${message.role}`}>
      <StyledMarkdown markdown={message.content} />
    </div>
  );
};
