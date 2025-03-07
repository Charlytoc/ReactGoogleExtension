import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChromeStorageManager } from "../../../managers/Storage";
import { TMessage, TNote } from "../../../types";
import { Button } from "../../../components/Button/Button";
import { SVGS } from "../../../assets/svgs";
import { useTranslation } from "react-i18next";
import { cacheLocation } from "../../../utils/lib";
import { StyledMarkdown } from "../../../components/RenderMarkdown/StyledMarkdown";
import { Section } from "../../../components/Section/Section";
import { NoteEditor } from "../../../components/Note/Note";
import {
  convertToMessage,
  createStreamingResponseWithFunctions,
  createToolsMap,
  toolify,
  TTool,
} from "../../../utils/ai";
import { LabeledInput } from "../../../components/LabeledInput/LabeledInput";
import { useStore } from "../../../managers/store";
import { useShallow } from "zustand/shallow";
import { Message } from "../../../components/Chat/Chat";

const Prompter = ({
  systemPrompt,
  functions,
}: // onComplete,
{
  systemPrompt: string;
  // apiKey: string;
  functions: TTool[];
  // onComplete: (response: string) => void;
}) => {
  const { t } = useTranslation();
  const auth = useStore(useShallow((state) => state.config.auth));
  const [messages, setMessages] = useState<TMessage[]>([
    { role: "system", content: systemPrompt },
  ]);
  const [state, setState] = useState<{
    isGenerating: boolean;
    isOpen: boolean;
    response: string;
    userMessage: string;
  }>({
    isGenerating: false,
    response: "",
    isOpen: false,
    userMessage: "",
  });

  useEffect(() => {
    setMessages((prev) => {
      let newMessages = [...prev];
      const systemMessage = newMessages.find((m) => m.role === "system");
      if (systemMessage) {
        systemMessage.content = systemPrompt;
      } else {
        newMessages.unshift({ role: "system", content: systemPrompt });
      }
      return newMessages;
    });
  }, [systemPrompt]);

  const handleGenerate = async () => {
    setState({ ...state, isGenerating: true });

    const userMessage: TMessage = { role: "user", content: state.userMessage };
    const assistantMessage: TMessage = { role: "assistant", content: "" };
    const newMessages = [...messages, userMessage, assistantMessage];

    setState((prev) => ({ ...prev, userMessage: "" }));
    setMessages(newMessages);

    await createStreamingResponseWithFunctions(
      {
        messages: newMessages.map(convertToMessage),
        model: "gpt-4o-mini",
        temperature: 0.4,
        apiKey: auth.openaiApiKey,
        max_completion_tokens: 16000,
        response_format: { type: "text" },
        tools: functions.map((tool) => tool.schema),
        functionMap: createToolsMap(functions),
      },
      (chunk) => {
        const text = chunk.choices[0].delta.content;
        if (text) {
          setMessages((prev) => {
            let newMessages = [...prev];
            const lastAssistantMessage = newMessages.pop();

            if (!lastAssistantMessage) return newMessages;
            lastAssistantMessage.content += text;
            return [...newMessages, lastAssistantMessage];
          });
        }
      }
    );
    setState((prev) => ({ ...prev, isGenerating: false }));
  };
  return (
    <>
      <Button
        title={t("continueWithAI")}
        className={`w-100 justify-center padding-5 ${
          state.isGenerating ? "bg-active" : ""
        }`}
        onClick={() => setState({ ...state, isOpen: true })}
        svg={SVGS.ai}
      />
      {state.isOpen && (
        <div className="prompter-container bg-gradient flex-column gap-10 ">
          {messages.map((message, index) => {
            if (message.role === "system") return null;
            return <Message key={index} message={message} />;
          })}

          <LabeledInput
            autoFocus
            label={t("userMessage")}
            type="text"
            name="userMessage"
            value={state.userMessage}
            onChange={(value) =>
              setState({
                ...state,
                userMessage: value,
              })
            }
          />

          <div className="flex-row gap-5">
            <Button
              title={t("generate")}
              onClick={handleGenerate}
              svg={SVGS.ai}
              text={state.isGenerating ? t("generating") : t("execute")}
              className="w-100 justify-center padding-5 "
            />
            <Button
              title={t("close")}
              text={t("close")}
              className="w-100 justify-center padding-5 "
              onClick={() => setState({ ...state, isOpen: false })}
              svg={SVGS.close}
            />
          </div>
        </div>
      )}
    </>
  );
};
export default function NoteDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [notes, setNotes] = useState<TNote[]>([]);

  if (!id) return <div>No id</div>;
  const [note, setNote] = useState<TNote>({
    id: id,
    title: "",
    content: "",
    color: "var(--bg-color)",
    tags: [],
    archived: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  // const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getNote();
  }, [id]);

  useEffect(() => {
    if (note) {
      saveNote();
    }
  }, [note]);

  const getNote = async () => {
    const notes: TNote[] = await ChromeStorageManager.get("notes");
    // Use the index to get the note
    const note = notes.find((note) => note.id === id);
    if (!note) {
      cacheLocation("/notes");
      navigate("/notes");
    } else {
      setNote(note);
      setNotes(notes);
    }
  };

  const saveNote = async () => {
    // let notes = await ChromeStorageManager.get("notes");
    let newNotes = [...notes];
    if (!note) return;

    if (!newNotes) {
      newNotes = [note];
    } else {
      newNotes = newNotes.map((n: TNote) => {
        if (n.id === id) {
          return { ...n, ...note };
        }
        return n;
      });
    }

    await ChromeStorageManager.add("notes", newNotes);
  };

  // const replaceInNote = toolify(
  //   ({
  //     searchString,
  //     replacement,
  //   }: {
  //     searchString: string;
  //     replacement: string;
  //   }) => {
  //     const newContent = note.content?.replace(searchString, replacement) || "";
  //     if (!newContent) return "No replacement provided";
  //     setNote({ ...note, content: newContent });
  //     return "Note updated successfully";
  //   },
  //   "replaceInNote",
  //   "Replace a particular part of the note content. Use this tool when you need to update a specific part of the note.",
  //   {
  //     searchString: {
  //       type: "string",
  //       description: "The string to search for in the note",
  //     },
  //     replacement: {
  //       type: "string",
  //       description: "The new content to update the note",
  //     },
  //   }
  // );

  const updateEntireNote = toolify(
    (newContent: { newContent: string }) => {
      console.log("AI wants to update the entire note", newContent);
      setNote({ ...note, content: newContent.newContent });
      return "Note updated successfully";
    },
    "updateEntireNote",
    "Update the entire note content. Use this tool when you need to make big changes to the note.",
    {
      newContent: {
        type: "string",
        description: "The new content to update the note",
      },
    }
  );

  return (
    <div className=" padding-10">
      {isEditing ? (
        <Section
          title={note?.title || ""}
          extraButtons={
            <>
              <Button
                svg={SVGS.save}
                title={t("save")}
                className="w-100 justify-center padding-5 "
                onClick={() => {
                  setIsEditing(false);
                  saveNote();
                }}
              />
            </>
          }
        >
          <NoteEditor
            note={note}
            setNote={setNote}
            close={() => {
              setIsEditing(false);
            }}
          />
        </Section>
      ) : (
        <Section
          close={async () => {
            const prevPage = await ChromeStorageManager.get("prevPage");

            cacheLocation(prevPage, "lastPage");
            navigate(prevPage);
          }}
          title={note?.title || ""}
          extraButtons={
            <>
              <Button
                svg={SVGS.edit}
                title={t("edit")}
                className="w-100 justify-center padding-5 "
                onClick={() => setIsEditing(true)}
              />

              <Prompter
                systemPrompt={`
## SYSTEM

You are a powerful note taking assistant.
You will be given a note and you will need to update the note based on the context and instructions you have. 

The title of the note is: "${note.title}"

The content of the note is: 
"""
${note.content}
"""
                
## RULES
- Use the right tool depending on the task in hand.
- Provide useful insights about the note and the changes you are making.
- Ask for clarification if needed.
  
                    `}
                functions={[updateEntireNote]}
              />
            </>
          }
        >
          <StyledMarkdown markdown={note?.content || ""} />
        </Section>
      )}
    </div>
  );
}
