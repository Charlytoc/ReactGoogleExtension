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
                    );
                    reject(
                        chrome.runtime.lastError.message || "Error adding value to storage"
                    );
                } else {
                    onSuccess?.();
                    resolve();
                }
            });
        });
    },

    // Obtener un valor del almacenamiento
    get: async (key) => {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(key, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message);
                } else {
                    resolve(result[key]);
                }
            });
        });
    },

    // Eliminar un valor del almacenamiento
    delete: async (key) => {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(key, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message);
                } else {
                    resolve();
                }
            });
        });
    },
};



const createRandomId = () => {
    return (
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
    );
};

const notify = (title, message) => {
    chrome.notifications.create(createRandomId(), {
        title: title,
        message: message,
        iconUrl: "icons/icon.png",
        type: "basic",
    });
};

const retrieveFromLs = (key, callback) => {
    ChromeStorageManager.get(key, (result) => {
        callback(result[key]);
    });
};

const updateTask = async (task) => {
    const tasks = await ChromeStorageManager.get("tasks");
    if (tasks) {

        const taskIndex = tasks.find((t) => t.id === task.id);
        if (taskIndex !== -1) {
            tasks[taskIndex] = task;
            await ChromeStorageManager.add("tasks", tasks);
        }
    }
};



chrome.alarms.onAlarm.addListener(async function (alarm) {
    const notifyMessage = async (tasks) => {
        // Get the task with the id of the alarm
        if (alarm.name.includes("-endOfTask")) {
            const taskId = alarm.name.split("-endOfTask")[0];
            const task = tasks.find((task) => task.id === taskId);

            chrome.notifications.create(createRandomId(), {
                title: String(task.title),
                message: "Task should be completed now!",
                iconUrl: "icons/icon.png",
                type: "basic",
            });

            chrome.alarms.clear(task.id);
            chrome.alarms.clear(task.id + "-endOfTask");
            console.log("Alarms for task", task.id, "cleared successfully!");
            return;
        }

        const task = tasks.find((task) => task.id === alarm.name);

        const alarmInfo = task;


        if (!alarmInfo) {
            console.log("No alarmInfo for alarm", alarm.name);
            return;
        }

        const now = new Date();



        chrome.notifications.create(createRandomId(), {
            title: String(alarmInfo.title),
            message: String(alarmInfo.motivationText ? alarmInfo.motivationText : alarmInfo.description),
            iconUrl: "icons/icon.png",
            type: "basic",
        });

        const updatedTask = {
            ...alarmInfo,
            lastReminderAt: now.toISOString()
        }
        await updateTask(updatedTask);
    }
    retrieveFromLs("tasks", notifyMessage);
});


chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "mi-opcion",
        title: "Haz algo interesante",
        contexts: ["all"], // Contextos: "page", "selection", "link", etc.
    });
});




// Define la función que se ejecutará dentro de la pestaña
function pegarHelloWorld() {
    // Selecciona el elemento deseado (ajusta el selector según tu necesidad)
    const elemento = document.activeElement; // Ejemplo: elemento actualmente seleccionado
    console.log(elemento, "ELEMENTO ACTIVO");
    if (elemento) {
        console.log(elemento.textContent, "ELEMENTO TEXTO");
        // IF THE ELEMENT IS A TEXT AREA OR INPUT, WE ADD THE TEXT TO THE VALUE
        if (elemento.isContentEditable || /^(INPUT|TEXTAREA)$/.test(elemento.tagName)) {
            elemento.value += "Hello, World!";
        } else {
            notify("The target element is not a text area or input", "The target element is not a text area or input");
        }
    } else {
        console.error("No se encontró un elemento activo para modificar.");
    }
    return "Hello, World!";
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "mi-opcion") {

        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: pegarHelloWorld,
            injectImmediately: true
        });

        console.log(result, "RESULT");
    }
});

