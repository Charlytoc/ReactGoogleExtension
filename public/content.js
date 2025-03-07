// (function () {
//     console.log("Content script loaded")

//     let currentButton = null
//     let isGenerating = false
//     document.addEventListener("focusin", (event) => {
//         const activeElem = event.target

//         // Verifica si el elemento es un input o textarea
//         if (!(activeElem.tagName === "TEXTAREA" || (activeElem.tagName === "INPUT" && activeElem.type === "text"))) {
//             return
//         }

//         // Si ya hay un botón, eliminarlo antes de crear uno nuevo
//         if (currentButton) {
//             currentButton.remove()
//         }

//         // Crear el botón flotante
//         const btn = document.createElement("button")
//         btn.innerText = "✨"
//         btn.style.position = "absolute"
//         btn.style.zIndex = "1000"
//         btn.style.cursor = "pointer"
//         btn.style.opacity = "0.8"
//         btn.style.border = "none"
//         btn.style.background = "#007bff"
//         btn.style.color = "white"
//         btn.style.borderRadius = "50%"
//         btn.style.width = "30px"
//         btn.style.height = "30px"
//         btn.style.fontSize = "16px"
//         btn.style.textAlign = "center"
//         btn.style.lineHeight = "30px"
//         btn.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.3)"

//         // Posicionar el botón arriba y a la izquierda del input
//         const rect = activeElem.getBoundingClientRect()
//         btn.style.top = `${window.scrollY + rect.top - 35}px`  // Mueve el botón arriba
//         btn.style.left = `${window.scrollX + rect.left - 35}px` // Mueve el botón a la izquierda

//         // Agregar el botón al documento
//         document.body.appendChild(btn)
//         currentButton = btn


//         btn.addEventListener("click", () => {
//             if (isGenerating) {
//                 return
//             }
//             isGenerating = true
//             console.log("Button clicked")
//             chrome.runtime.sendMessage({
//                 action: "generateCompletion", model: "gpt-4o-mini", messages: [{
//                     role: "system", content: `You are a helpful assistant that fills inputs and textareas with text.
            
//             You must fill the input or textarea with the most possible text depending on the available context.
            
//             You must not add any other text or comment, only the text to fill the input or textarea.

//             This is the website text content: 
//             ---
//             ${document.body.innerText}
//             ---

//             This is the input or textarea current value:
//             ---
//             ${activeElem.value}
//             ---

//             You should return the most possible text to fill the input or textarea.

//             ## Examples:
//             Input: Context about the website, the website is a form with different inputs and textareas. The active element will be one of those inputs, suppose the inputs is: What is the capital of France?
//             Output: Paris

//             Input: The website is a chat with an AI, the input is the prompt, if you have the context of the conversation, you should return the most next user message.
//             Output: Hello, how are you?

//             ## Rules:
//             - You should return the most possible text to fill the input or textarea.
//             - You should not add any other text or comment, only the text to fill the input or textarea.
            
//             ` }, { role: "user", content: activeElem.value }], temperature: 0.5
//             }, (response) => {
//                 if (response && typeof response === "string") {
//                     activeElem.value = response
//                     isGenerating = false
//                     console.log("Response generated", isGenerating)


//                 }
//             })
//         })

//         // Eliminar el botón si el usuario cambia de campo
//         activeElem.addEventListener("blur", () => {
//             setTimeout(() => {
//                 if (currentButton && !isGenerating) {
//                     currentButton.remove()
//                     currentButton = null
//                 }
//             }, 1000)
//         }, { once: true })
//     })
// })()
