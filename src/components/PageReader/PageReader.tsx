import { useEffect, useState } from "react";

export const PageReader: React.FC = () => {
  const [content, setContent] = useState<string>("");
  const [currentUrl, setCurrentUrl] = useState<string>("");

  const extractText = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      setCurrentUrl(tabs[0].url || "");
      chrome.scripting
        .executeScript({
          target: { tabId: tabs[0].id },
          func: () => document.body.innerText, // Extrae solo el texto visible
        })
        .then((results) => {
          if (results && results[0] && results[0].result) {
            setContent(results[0].result);
          }
        })
        .catch(console.error);
    });
  };

  const resumeWebsite = () => {
    console.log(currentUrl, content);
  };

  useEffect(() => {
    resumeWebsite();
  }, [content, currentUrl]);

  return (
    <div>
      <button onClick={extractText}>Extraer Texto</button>
      <h3>{currentUrl}</h3>
      <textarea value={content} readOnly rows={10} cols={50}></textarea>
    </div>
  );
};
