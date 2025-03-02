import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChromeStorageManager } from "../../../managers/Storage";
import { TNote } from "../../../types";
import { Button } from "../../../components/Button/Button";
import { SVGS } from "../../../assets/svgs";
import { useTranslation } from "react-i18next";
import { cacheLocation } from "../../../utils/lib";
import { StyledMarkdown } from "../../../components/RenderMarkdown/StyledMarkdown";
import { Section } from "../../../components/Section/Section";
import { NoteEditor } from "../../../components/Note/Note";
import {
  createCompletionWithFunctions,
  toolify,
  TTool,
} from "../../../utils/ai";
import { LabeledInput } from "../../../components/LabeledInput/LabeledInput";
import { useStore } from "../../../managers/store";
import { useShallow } from "zustand/shallow";
import toast from "react-hot-toast";

const Prompter = ({
  systemPrompt,
  functions,
  onComplete,
}: {
  systemPrompt: string;
  // apiKey: string;
  functions: TTool[];
  onComplete: (response: string) => void;
}) => {
  const { t } = useTranslation();
  const auth = useStore(useShallow((state) => state.config.auth));
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

  const handleGenerate = async () => {
    setState({ ...state, isGenerating: true });

    let toolNames = functions.map((tool) => tool.schema.function.name);
    let toolFunctions = functions.map((tool) => tool.function);

    let functionMap: Record<
      string,
      (args: Record<string, any>) => Promise<string>
    > = {};
    for (let i = 0; i < toolNames.length; i++) {
      functionMap[toolNames[i]] = toolFunctions[i];
    }

    await createCompletionWithFunctions(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: state.userMessage },
        ],
        model: "gpt-4o-mini",
        temperature: 0.8,
        max_completion_tokens: 16000,
        response_format: { type: "text" },
        tools: functions.map((tool) => tool.schema),
      },
      auth.openaiApiKey,
      (completion) => {
        const response = completion.choices[0].message.content;
        if (!response) return;
        if (typeof onComplete === "function") {
          onComplete(response);
        }
        setState({ ...state, response: response });
      },
      functionMap
    );
    setState({ ...state, isGenerating: false });
  };
  return (
    <>
      <Button
        title={t("continueWithAI")}
        className="w-100 justify-center padding-5 "
        onClick={() => setState({ ...state, isOpen: true })}
        svg={SVGS.ai}
      />
      {state.isOpen && (
        <div className="prompter-container bg-gradient flex-column gap-10">
          <div className="prompter-response">
            {state.response}
            <div className="prompter-response-actions">
              <Button
                title={t("close")}
                className="w-100 justify-center padding-5 "
                onClick={() => setState({ ...state, isOpen: false })}
                svg={SVGS.close}
              />
            </div>
          </div>
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

          <Button
            title={t("generate")}
            onClick={handleGenerate}
            svg={SVGS.ai}
            text={t("execute")}
            className="w-100 justify-center padding-5 "
          />
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

  const updateNote = toolify(
    ({
      searchString,
      replacement,
    }: {
      searchString: string;
      replacement: string;
    }) => {
      console.log("AI wants to update the note", replacement);
      const newContent = note.content?.replace(searchString, replacement) || "";
      if (!newContent) return "No replacement provided";
      setNote({ ...note, content: newContent });
      return "Note updated successfully";
    },
    "updateNote",
    "Update the note content",
    {
      searchString: {
        type: "string",
        description: "The string to search for in the note",
      },
      replacement: {
        type: "string",
        description: "The new content to update the note",
      },
    }
  );

  const appendToEnd = toolify(
    (newContent: { newContent: string }) => {
      console.log("AI wants to add this content to the note", newContent);
      toast.success("being called");
      let newContentString = note.content
        ? note.content + newContent.newContent
        : newContent.newContent;

      console.log("NEW CONTENT STRING", newContentString);
      setNote({ ...note, content: newContentString });
      return "Note updated successfully";
    },
    "appendToEnd",
    "Append to the end of the note",
    {
      newContent: {
        type: "string",
        description: "The new content to append to the end of the note",
      },
    }
  );

  return (
    <div className=" padding-10">
      {isEditing ? (
        <Section
          close={async () => {
            const prevPage = await ChromeStorageManager.get("prevPage");
            cacheLocation(prevPage, "lastPage");
            navigate(prevPage);
          }}
          title={note?.title || ""}
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
                // onResult={continueWithAI}
                systemPrompt={`
                You are a powerful note taking assistant.
                You will be given a note and you will need to update the note based on the context you have. It may be necessary to update the node in an specific way, based on the context.

                <NOTE>
                Title: "${note.title}"
                Content: """${note.content}"""


                </NOTE>

                Use all the tools available to you to update the note.
                Provide useful insights about the note and the changes you are making. In the text response, include the changes you are making to the note.

                <RESPONSE>
                  The response should be a text response to the user with the changes you are making to the note. Only text and function calls.
                </RESPONSE>
                    `}
                functions={[updateNote, appendToEnd]}
                onComplete={(response) => {
                  console.log("RESPONSE ON COMPLETE", response);
                }}
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
