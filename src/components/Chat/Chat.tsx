import { useEffect, useState } from "react";
import { createStreamingResponse } from "../../utils/ai";
import { Textarea } from "../Textarea/Textarea";
import { ChromeStorageManager } from "../../managers/Storage";
import { Button } from "../Button/Button";
import { TMessage } from "../../types";
import { SVGS } from "../../assets/svgs";
import "./Chat.css";
import { StyledMarkdown } from "../RenderMarkdown/StyledMarkdown";
import { cacheLocation } from "../../utils/lib";
import { useNavigate } from "react-router";
import { notify } from "../../utils/chromeFunctions";
import { TConversation } from "../../types";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Section } from "../Section/Section";

const getRandomHash = () => {
  return Math.random().toString(36).substring(2, 15);
};

const defaultMessages: TMessage[] = [
  { role: "system", content: "You are a helpful assistant." },
];

export const Chat = () => {
  const [messages, setMessages] = useState<TMessage[]>(defaultMessages);
  const [conversation, setConversation] = useState<TConversation | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [aiConfig, setAiConfig] = useState<TAIConfig>({
    systemPrompt: "You are a helpful assistant.",
    model: "chatgpt-4o-latest",
  });
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [conversations, setConversations] = useState<TConversation[]>([]);
  const [showConversations, setShowConversations] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    getApiKey();
    getConversations();
    getAiConfig();
  }, []);

  useEffect(() => {
    const newMessages = messages.map((message) => {
      if (message.role === "system") {
        return { ...message, content: aiConfig.systemPrompt };
      }
      return message;
    });
    setMessages(newMessages);
  }, [aiConfig]);

  const getApiKey = async () => {
    const apiKey = await ChromeStorageManager.get("openaiApiKey");
    if (!apiKey) {
      setError("No API key found");
    }

    setApiKey(apiKey);
  };

  const getAiConfig = async () => {
    const aiConfig = await ChromeStorageManager.get("aiConfig");
    if (aiConfig) {
      setAiConfig(aiConfig);
    }
  };

  const updateAiConfig = async (newConfig: TAIConfig) => {
    setAiConfig(newConfig);
    await ChromeStorageManager.add("aiConfig", newConfig);
    notify(t("aiConfigUpdated"), "✅");
    setShowConfig(false);
  };

  const createNewConversation = () => {
    const newConversation: TConversation = {
      messages: [],
      title: "Conversation-" + getRandomHash(),
      date: new Date().toISOString(),
    };
    setConversation(newConversation);
  };

  const getConversations = async () => {
    const conversations = await ChromeStorageManager.get("conversations");
    setConversations(conversations);
    createNewConversation();
  };

  const handleSendMessage = async () => {
    const message: TMessage = {
      role: "user",
      content: input,
    };
    const newMessages = [...messages, message];
    setMessages(newMessages);

    createStreamingResponse(
      newMessages,
      apiKey,
      aiConfig.model,
      0.5,
      4000,
      (chunk) => {
        setMessages((prevMessages) => {
          const newMessages = [...prevMessages];
          if (
            newMessages.length === 0 ||
            newMessages[newMessages.length - 1].role === "user"
          ) {
            newMessages.push({ role: "assistant", content: chunk });
          }

          if (newMessages[newMessages.length - 1].role === "assistant") {
            newMessages[newMessages.length - 1].content += chunk;
          }

          return newMessages;
        });
      }
    );
  };

  const saveConversation = () => {
    if (!conversation) return;
    // if the conversation is already in the list, update it
    const newConversations = conversations.map((c) =>
      c.title === conversation.title
        ? { ...c, ...conversation, messages: messages }
        : c
    );
    // find if the conversation is already in the list
    const conversationIndex = newConversations.findIndex(
      (c) => c.title === conversation.title
    );
    if (conversationIndex === -1) {
      newConversations.push({ ...conversation, messages: messages });
    }
    setConversations(newConversations);
    ChromeStorageManager.add("conversations", newConversations);
    toast.success(t("conversationSaved"), {
      icon: "✅",
    });
  };

  const deleteConversation = (conversation: TConversation) => {
    const newConversations = conversations.filter(
      (c) => c.title !== conversation.title
    );
    setConversations(newConversations);
    ChromeStorageManager.add("conversations", newConversations);
    toast.success(t("conversationDeleted").replace("%s", conversation.title), {
      icon: "❌",
    });
  };

  const loadConversation = (conversation: TConversation) => {
    setMessages(conversation.messages);
    setShowConversations(false);
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
          <Button
            className="padding-5 "
            title={t("saveConversation")}
            onClick={saveConversation}
            svg={SVGS.save}
          />

          <Button
            className={`padding-5 ${showConversations ? "bg-active" : ""}`}
            onClick={() => setShowConversations(!showConversations)}
            svg={SVGS.chat}
            title={t("showConversations")}
          />

          <Button
            className={`padding-5 ${showConfig ? "bg-active" : ""}`}
            onClick={() => setShowConfig(!showConfig)}
            svg={SVGS.gear}
            title={t("showConfig")}
          />
        </>
      }
    >
      <div className="flex-column w-100 gap-10 chat-container">
        {error && <div className="bg-danger">{error}</div>}

        {showConversations && (
          <section className="flex-column gap-10 chat-messages">
            {conversations.map((conversation, index) => (
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
                      c.title === conversation.title
                        ? { ...c, title: newTitle }
                        : c
                    );
                    setConversations(newConversations);
                    ChromeStorageManager.add("conversations", newConversations);
                    toast.success(t("conversationSaved"), {
                      icon: "✅",
                    });
                  }}
                >
                  {conversation.title}
                </h3>
                <div className="flex-row gap-10 justify-between w-100 align-center">
                  <p>{new Date(conversation.date).toLocaleString()}</p>
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
            ))}
          </section>
        )}
        <section className="flex-row gap-10"></section>
        <section className="flex-column gap-10 chat-messages">
          {!showConversations &&
            messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <StyledMarkdown markdown={message.content} />
              </div>
            ))}
        </section>
        {showConfig && (
          <AIConfig
            key={aiConfig.systemPrompt}
            aiConfig={aiConfig}
            updateAiConfig={updateAiConfig}
          />
        )}
        <section className="flex-row gap-10 w-100  padding-5 ">
          <Textarea
            className="w-100"
            key={messages.length}
            defaultValue=""
            onChange={(value) => setInput(value)}
          />
          <Button
            className=" padding-5 align-center justify-center active-on-hover"
            svg={SVGS.send}
            onClick={handleSendMessage}
          />
        </section>
      </div>
    </Section>
  );
};

type TAIConfig = {
  systemPrompt: string;
  model: string;
};

const models = ["gpt-4o", "gpt-3.5-turbo", "gpt-4o-mini", "chatgpt-4o-latest"];

const AIConfig = ({
  aiConfig,
  updateAiConfig,
}: {
  aiConfig: TAIConfig;
  updateAiConfig: (newConfig: TAIConfig) => void;
}) => {
  const { t } = useTranslation();
  const [systemPrompt, setSystemPrompt] = useState<string>(
    aiConfig.systemPrompt
  );
  const [model, setModel] = useState<string>(aiConfig.model);

  const finishConfig = () => {
    updateAiConfig({ systemPrompt, model });
  };

  return (
    <div className="flex-column gap-10  padding-10 rounded">
      <h2>{t("aiConfig")}</h2>
      <Textarea
        label={t("systemPrompt")}
        // placeholder={t("systemPrompt")}
        className="w-100  padding-5 rounded"
        defaultValue={systemPrompt}
        onChange={(value) => {
          setSystemPrompt(value);
        }}
      />
      <h3>{t("model")}</h3>
      <select
        className="w-100 border-gray padding-5 rounded"
        value={model}
        onChange={(e) => {
          setModel(e.target.value);
        }}
      >
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      <h2>{t("notesConfig")}</h2>
      <div className="flex-row gap-10">
        <input type="checkbox" name="auto-save-notes" />
        <span>{t("autoSaveNotes")}</span>
      </div>
      <Button
        className="w-100 padding-5 justify-center"
        text={t("finishConfig")}
        title={t("finishConfig")}
        svg={SVGS.save}
        onClick={finishConfig}
      />
    </div>
  );
};
