
const createCompletion = async (request, callback) => {
    const apiKey = await ChromeStorageManager.get("openaiApiKey")
    if (!apiKey) {
        throw new Error("No API key found")
    }
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.max_completion_tokens || 500,
            response_format: {
                type: "text",
            },
        }),
    })

    if (!response.ok) {
        console.log(response, "RESPONSE")
        throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const completion = await response.json()

    if (typeof callback === "function") {
        callback(completion)
    }

    return completion.choices[0].message.content
}




const ChromeStorageManager = {
    // Agregar un valor al almacenamiento
    add: async (
        key,
        value,
        onSuccess,
        onError
    ) => {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ [key]: value }, () => {
                if (chrome.runtime.lastError) {
                    onError?.(
                        chrome.runtime.lastError.message || "Error adding value to storage"
                    )
                    reject(
                        chrome.runtime.lastError.message || "Error adding value to storage"
                    )
                } else {
                    onSuccess?.()
                    resolve()
                }
            })
        })
    },

    // Obtener un valor del almacenamiento
    get: async (key) => {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(key, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message)
                } else {
                    resolve(result[key])
                }
            })
        })
    },

    // Eliminar un valor del almacenamiento
    delete: async (key) => {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(key, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message)
                } else {
                    resolve()
                }
            })
        })
    },
}



const createRandomId = () => {
    return (
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
    )
}

const notify = (title, message) => {
    chrome.notifications.create(createRandomId(), {
        title: title,
        message: message,
        iconUrl: "icons/icon.png",
        type: "basic",
    })
}

const retrieveFromLs = async (key, callback) => {
    const result = await ChromeStorageManager.get(key)
    callback(result)
}

const updateTask = async (task) => {
    const tasks = await ChromeStorageManager.get("tasks")
    if (tasks) {
        const taskIndex = tasks.find((t) => t.id === task.id)
        if (taskIndex !== -1) {
            tasks[taskIndex] = task
            await ChromeStorageManager.add("tasks", tasks)
        }
    }
}



chrome.alarms.onAlarm.addListener(async function (alarm) {

    const notifyMessage = async (tasks) => {
        // Get the task with the id of the alarm
        if (alarm.name.includes("-endOfTask")) {
            const taskId = alarm.name.split("-endOfTask")[0]
            const task = tasks.find((task) => task.id === taskId)

            chrome.notifications.create(createRandomId(), {
                title: String(task.title),
                message: "Task should be completed now!",
                iconUrl: "icons/icon.png",
                type: "basic",
            })

            chrome.alarms.clear(task.id)
            chrome.alarms.clear(task.id + "-endOfTask")
            console.log("Alarms for task", task.id, "cleared successfully!")
            return
        }

        const task = tasks.find((task) => task.id === alarm.name)

        console.log("FOUND TASK", task)

        const alarmInfo = task


        if (!alarmInfo) {
            console.log("No alarmInfo for alarm", alarm.name)
            return
        }

        const now = new Date()



        chrome.notifications.create(createRandomId(), {
            title: String(alarmInfo.title),
            message: String(alarmInfo.motivationText ? alarmInfo.motivationText : alarmInfo.description),
            iconUrl: "icons/icon.png",
            type: "basic",
        })

        const updatedTask = {
            ...alarmInfo,
            lastReminderAt: now.toISOString()
        }
        await updateTask(updatedTask)
        // const textToSpeak = String(alarmInfo.motivationText ? alarmInfo.motivationText : alarmInfo.description)
        // chrome.tts.speak(textToSpeak, {
        //     rate: 1.0,
        //     pitch: 1.0,
        //     volume: 1.0,
        //     lang: "en-US",
        //     voiceName: "Samantha"
        // })
    }
    // console.log("Retrieving tasks from LS")
    await retrieveFromLs("tasks", notifyMessage)

})


chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "auto-complete",
        title: "Auto Complete",
        contexts: ["all"],
    })
})




async function autoComplete() {
    const activeElem = document.activeElement
    const innerText = document.body.innerText

    if (activeElem) {
        chrome.runtime.sendMessage({
            action: "generateCompletion",
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an useful assistant working for a Google Extension. Your task is to assist the user filling inputs with the text that best match the user intent. You will get the page context so you can figure out what the user intent is. You will also get the active element to give you more context.
                    
                    
                    This is the page context: ---
                    ${innerText}
                    ---
                    
                    This is the active element: ---
                    ${activeElem.outerHTML}
                    ---

                    The current text of the input is: ---
                    ${activeElem.value}
                    ---

                    Return only the next text of the input, no other text or comment are allowed.
                    If the input already have text, you must continue writting the text, otherwise you should return the complete text to fill the input.

                    Examples:
                    Input: "Hello, how ar"
                    Output: "Hello, how are you?"

                    Input: "What is the capital of Fr"
                    Output: "What is the capital of France?"
                    

                    `
                },
                {
                    role: "user",
                    content: `Fill the element please.`
                }
            ],
            max_completion_tokens: 500,
            temperature: 0.5,
            response_format: { type: "text" }
        }, (fillWith) => {
            if (fillWith) {
                let newContent = fillWith.replace(/^"|"$/g, '')

                if (activeElem.isContentEditable || /^(INPUT|TEXTAREA)$/.test(activeElem.tagName)) {
                    activeElem.value = newContent
                } else {
                    chrome.runtime.sendMessage({
                        action: "notify",
                        title: "Invalid Target",
                        message: "The target element is not a text area or input."
                    })
                }
            }
        })
    } else {
        console.error("No active element found to modify.")
    }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "auto-complete") {

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: autoComplete,
            injectImmediately: true
        })


    }
})



chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "generateCompletion") {
        (async () => {
            try {
                const fillWith = await createCompletion(request, (completion) => {
                    console.log(completion, "COMPLETION")

                })
                sendResponse(fillWith)
            } catch (error) {
                console.error("Error generating completion:", error)
                sendResponse(null)
                notify("Error", "Error generating completion: " + error.message)
            }
        })()
        return true
    }

    if (request.action === "notify") {
        notify(request.title, request.message)
    }
})


chrome.commands.onCommand.addListener(async (command) => {
    // console.log(command, "COMMAND RECEIVED")
    if (command === "auto-complete") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

        if (tab) {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: autoComplete,
                injectImmediately: true
            })
        }
    }

    if (command === "open-automator") {
        // Open the extension popup (open a new window/tab pointing to the popup page)
        const popupUrl = chrome.runtime.getURL('index.html')
        // Try to focus an existing tab with the popup, otherwise create one
        const tabs = await chrome.tabs.query({ url: popupUrl })
        if (tabs && tabs.length > 0) {
            await chrome.tabs.update(tabs[0].id, { active: true })
            await chrome.windows.update(tabs[0].windowId, { focused: true })
        } else {
            await chrome.tabs.create({ url: popupUrl })
        }
    }
})
