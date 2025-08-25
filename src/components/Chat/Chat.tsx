import { useEffect, useState } from "react";
import {
  convertToMessage,
  createCompletion,
  // createStreamingResponse,
  createStreamingResponseWithFunctions,
  createToolsMap,
  listModels,
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
import { Select } from "../Select/Select";

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
    model: { name: "gpt-4o-mini", slug: "gpt-4o-mini", hasReasoning: false },
    autoSaveConversations: false,
    setTitleAtMessage: 0,
  });
  const [activeTab, setActiveTab] = useState<TChatTab>("chat");
  const [conversations, setConversations] = useState<TConversation[]>([]);
  const [error, setError] = useState<string>("");
  const [attachments, setAttachments] = useState<TAttachment[]>([]);
  const autoScroll = true;
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    getApiKey();
    getConversations();
    getAiConfig();
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
          name: "gpt-4o-mini",
          slug: "gpt-4o-mini",
          hasReasoning: false,
        },
        autoSaveConversations: false,
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
    if (!conversations) {
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

  const handleSendMessage = async () => {
    if (!input) return;

    let url = "";

    try {
      const { url: _url } = await extractPageData(0, 0.01);
      url = _url;
    } catch (error) {
      console.log("error trying to get url", error);
    }
    const systemPrompt = `${aiConfig.systemPrompt}\n${url ? `Current URL: ${url}` : ""}`;
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
      close={() => {
        navigate("/index.html");
        cacheLocation("/index.html", "/chat");
      }}
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
          <section className="flex-row gap-10 w-100 padding-5 ">
            <Textarea
              label={t("commandOrPrompt")}
              name="command"
              className="w-100"
              defaultValue={input}
              onChange={(value) => {
                setInput(value);
              }}
              onKeyUp={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />

            <div className="flex-column gap-5 floating-buttons">
              <Button
                // text={t("send")}
                title={t("send")}
                className=" padding-5 align-center justify-center active-on-hover"
                svg={SVGS.send}
                onClick={handleSendMessage}
              />
              <Button
                className=" padding-5 align-center justify-center active-on-hover"
                svg={SVGS.ai}
                // text={t("summarizeWebsite")}
                title={t("summarizeWebsite")}
                onClick={() => {
                  setInput(
                    "Summarize the current website and provide a list of the main points. /send"
                  );
                }}
              />
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
          <Select
            name="model"
            options={models.map((model) => ({
              label: model.name,
              value: model.slug,
            }))}
            defaultValue={_aiConfig.model.slug}
            onChange={(value) => {
              const model = models.find((m) => m.slug === value);
              if (model) {
                setAiConfig({ ..._aiConfig, model: model });
              }
            }}
          />
          {/* <Select
            name="reasoningTag"
            options={[
              { label: "thinking", value: "thinking" },
              { label: "reasoning", value: "reasoning" },
              { label: "thinking_process", value: "thinking_process" },
            ]}
            defaultValue={_aiConfig.reasoningTag || "thinking"}
            onChange={(value) => {
              setAiConfig({
                ..._aiConfig,
                reasoningTag: value as TReasoningTag,
              });
            }}
          /> */}
        </div>
        <h3>{t("conversationsConfig")}</h3>
        <div className="flex-row gap-10">
          <input
            className="checkbox"
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
    <Section
      className="bg-gradient"
      headerLeft={<h3 className="font-mono">{t("history")}</h3>}
      close={close}
    >
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
