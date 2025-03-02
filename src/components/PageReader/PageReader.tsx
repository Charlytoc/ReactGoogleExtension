import { useState } from "react";

export const PageReader: React.FC = () => {
  const [content, setContent] = useState<string>("");

  const extractHTML = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;

      chrome.scripting
        .executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            // Extract only the buttons, inputs, textarea and interactable elements
            const elements = document.body.querySelectorAll(
              "button, input, textarea, a"
            );
            return Array.from(elements).map((el) => {
              return {
                innerHTML: el.innerHTML,
                tagName: el.tagName,
                id: el.id,
                className: el.className,
                href: (el as HTMLAnchorElement).href,
              };
            });
          },
        })
        .then((results) => {
          if (results && results[0] && results[0].result) {
            console.log(results);

            setContent(JSON.stringify(results));
          }
        })
        .catch(console.error);
    });
  };

  return (
    <div>
      <button onClick={extractHTML}>Extraer HTML</button>
      <textarea value={content} readOnly rows={10} cols={50}></textarea>
    </div>
  );
};
