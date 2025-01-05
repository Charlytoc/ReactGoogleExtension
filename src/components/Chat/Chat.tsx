import { useEffect, useState } from "react";
import { createStreamingResponse } from "../../utils/ai";
import { Textarea } from "../Textarea/Textarea";
import { ChromeStorageManager } from "../../managers/Storage";
import { Button } from "../Button/Button";
import { TMessage } from "../../types";
import { SVGS } from "../../assets/svgs";
import "./Chat.css";
import { StyledMarkdown } from "../RenderMarkdown/StyledMarkdown";

const defaultMessages: TMessage[] = [
  {
    role: "system",
    content: "You are a helpful assistant. ",
  },
];

export const Chat = () => {
  const [messages, setMessages] = useState<TMessage[]>(defaultMessages);
  const [apiKey, setApiKey] = useState<string>("");
  const [input, setInput] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    getApiKey();
  }, []);

  const getApiKey = async () => {
    const apiKey = await ChromeStorageManager.get("openaiApiKey");
    if (!apiKey) {
      setError("No API key found");
    }

    setApiKey(apiKey);
  };

  const handleSendMessage = async () => {
    const message: TMessage = {
      role: "user",
      content: input,
    };
    const newMessages = [...messages, message];
    setMessages(newMessages);

    createStreamingResponse(newMessages, apiKey, (chunk) => {
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        if (
          newMessages.length === 0 ||
          newMessages[newMessages.length - 1].role === "user"
        ) {
          newMessages.push({ role: "assistant", content: "" });
        }

        if (newMessages[newMessages.length - 1].role === "assistant") {
          newMessages[newMessages.length - 1].content += chunk;
        }

        return newMessages;
      });
    });
  };

  return (
    <div className="flex-column w-100 gap-10 padding-10">
      {error && <div className="bg-danger">{error}</div>}
      {messages.map((message, index) => (
        <div key={index} className={`message ${message.role}`}>
          <StyledMarkdown markdown={message.content} />
        </div>
      ))}
      <Textarea
        key={messages.length}
        defaultValue=""
        onChange={(value) => setInput(value)}
      />
      <Button
        className=" border-gray padding-10"
        svg={SVGS.plus}
        text="Send"
        onClick={handleSendMessage}
      />
    </div>
  );
};
